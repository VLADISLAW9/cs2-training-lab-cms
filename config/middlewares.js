module.exports = ({ env }) => [
  "strapi::logger",
  "strapi::errors",
  {
    name: "strapi::security",
    config: {
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          "img-src": ["'self'", "data:", "blob:"],
          "media-src": ["'self'", "data:", "blob:"],
          "connect-src": ["'self'", "https:"],
          upgradeInsecureRequests: null,
        },
      },
    },
  },
  "strapi::cors",
  "strapi::poweredBy",
  "strapi::query",
  {
    name: "strapi::body",
    config: {
      formidable: { maxFileSize: env.int("UPLOAD_MAX_BYTES", 104857600) },
    },
  },
  "strapi::session",
  "strapi::favicon",
  "strapi::public",
];
