import React from 'react';

const ImageUploader = ({ onUpload, label, id, accept = "image/*" }) => {
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      onUpload(url, file);
    }
  };

  return (
    <div className="image-uploader">
      <label htmlFor={id} className="upload-label">
        {label}
      </label>
      <input
        type="file"
        id={id}
        accept={accept}
        onChange={handleFileChange}
        className="upload-input"
      />
    </div>
  );
};

export default ImageUploader;
