import multer from 'multer';
import {
  uploadFile,
  embedding,
  chatMessage,
} from '../../controllers/upload.controller';
import express from 'express';
const router = express.Router();
const storage = multer.diskStorage({
  destination: (req, file, callBack) => {
    callBack(null, 'uploads');
  },
  filename: (req, file, callBack) => {
    const pathName = Date.now() + file.originalname;
    callBack(null, pathName);
  },
});

const uploadStorage = multer({ storage: storage });

//Multiple files
router.post('/multiple', uploadStorage.array('file'), uploadFile);

router.post('/requestMessage', chatMessage);

router.post('/train', embedding);

export default router;
