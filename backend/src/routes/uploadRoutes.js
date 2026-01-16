const express = require('express');
const router = express.Router();
const uploadController = require('../controllers/uploadController');

router.get('/handshake', uploadController.handshake);
router.post('/upload-chunk', uploadController.uploadChunk);
router.post('/merge-chunks', uploadController.mergeChunks);
router.get('/files', uploadController.listFiles);
router.get('/peek/:fileName', uploadController.peekZip);
router.get('/download/:fileName', uploadController.downloadFile);

module.exports = router;