module.exports = ({ env }) => ({
  upload: {
    config: {
      provider: "local",
      sizeLimit: env.int("UPLOAD_MAX_BYTES", 104857600),
      security: {
        allowedTypes: ["image/jpeg", "image/png", "image/webp", "video/mp4"],
      },
      actionOptions: { upload: {}, uploadStream: {}, delete: {} },
    },
  },
});
