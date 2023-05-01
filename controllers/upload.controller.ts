import { PineconeClient } from '@pinecone-database/pinecone';
import { OpenAI } from 'langchain/llms';
import { Document } from 'langchain/document';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { OpenAIEmbeddings } from 'langchain/embeddings';
import { PineconeStore } from 'langchain/vectorstores';
import dotenv from 'dotenv';
import { loadQAChain } from 'langchain/chains';
import { PDFLoader } from 'langchain/document_loaders';
import { DocxLoader } from 'langchain/document_loaders';
dotenv.config();

const basePath = 'uploads/';

function fileLoad(fileName) {
  //Determine file's extension
  const extensionName = fileName.split('.').filter(Boolean).slice(1).join('.');

  let loader;
  if (extensionName === 'pdf') {
    loader = new PDFLoader(basePath + fileName, {
      splitPages: false,
      pdfjs: () => import('pdf-parse/lib/pdf.js/v1.9.426/build/pdf.js'),
    });
  } else {
    loader = new DocxLoader(basePath + fileName);
  }

  return loader;
}

export const uploadFile = async (req, res) => {
  try {
    res.json({ code: 200, data: req.files });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const embedding = async (req, res) => {
  try {
    console.log(req.body.fileArray);
    const pinecone = new PineconeClient();
    await pinecone.init({
      environment: process.env.PINECONE_ENVIRONMENT ?? '',
      apiKey: process.env.PINECONE_API_KEY ?? '',
    });

    const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX_NAME);

    req.body.fileArray.forEach(async (item, index) => {
      const loader = fileLoad(item.filename);

      const rawDocs = await loader.load();

      const textSplitter = new RecursiveCharacterTextSplitter({
        chunkSize: 500,
        chunkOverlap: 0,
      });

      const docs = await textSplitter.splitDocuments([
        new Document({
          pageContent: rawDocs[0].pageContent,
        }),
      ]);

      const embeddings = new OpenAIEmbeddings({
        openAIApiKey: process.env.OPENAI_API_KEY,
      });

      await PineconeStore.fromDocuments(docs, embeddings, {
        pineconeIndex: pineconeIndex,
        namespace: 'coco',
      });
    });
    res.status(200).send('Files uploaded successfully.');
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const chatMessage = async (req, res) => {
  try {
    const pinecone = new PineconeClient();

    await pinecone.init({
      environment: process.env.PINECONE_ENVIRONMENT ?? '', //this is in the dashboard
      apiKey: process.env.PINECONE_API_KEY ?? '',
    });

    const index = pinecone.Index(process.env.PINECONE_INDEX_NAME);

    /* create vectorstore*/
    const vectorStore = await PineconeStore.fromExistingIndex(
      new OpenAIEmbeddings({ openAIApiKey: process.env.OPENAI_API_KEY }),
      {
        pineconeIndex: index,
        textKey: 'text',
        namespace: 'coco',
      }
    );

    const llm = new OpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY,
      temperature: 0,
    });
    const results = await vectorStore.similaritySearch(req.body.value, 5);
    const chain = loadQAChain(llm, { type: 'stuff' });

    const result = chain
      .call({
        input_documents: results,
        question: req.body.value,
      })
      .then(async (row) => {
        res.json(row);
      });
  } catch (error) {
    console.log('message error = ', error);
    res.status(500).json({ message: 'Server error' });
  }
};
