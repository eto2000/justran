import React from 'react';

const ImageUploader = ({ onUpload, label, id }) => {
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        onUpload(event.target.result);
      };
      reader.readAsDataURL(file);
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
        accept="image/*"
        onChange={handleFileChange}
        className="upload-input"
      />
    </div>
  );
};

export default ImageUploader;
