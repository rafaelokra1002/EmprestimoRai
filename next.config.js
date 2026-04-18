/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {},
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals || []
      config.externals.push({
        "@whiskeysockets/baileys": "commonjs @whiskeysockets/baileys",
        "qrcode": "commonjs qrcode",
      })
    }
    return config
  },
}

module.exports = nextConfig
