const express = require('express');
const router = express.Router();

// POST /api/files/presign - Generate presigned URL for upload
router.post('/presign', (req, res) => {
  const { filename, file_type } = req.body;
  const fileKey = `uploads/${Date.now()}_${filename || 'file.pdf'}`;
  return res.json({
    success: true,
    data: {
      upload_url: `https://storage.infocare.ae/${fileKey}?signature=sample_sig`,
      file_url: `https://storage.infocare.ae/${fileKey}`,
      file_key: fileKey
    }
  });
});

// POST /api/files/complete - Mark upload completed
router.post('/complete', (req, res) => {
  const { file_key } = req.body;
  return res.json({
    success: true,
    message: 'File upload finalized',
    data: {
      file_key,
      status: 'active'
    }
  });
});

module.exports = router;
