/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: [
      "@whiskeysockets/baileys",
      "qrcode",
      "@hapi/boom",
      "ws",
      "bufferutil",
      "utf-8-validate",
    ],
  },
}

module.exports = nextConfig
