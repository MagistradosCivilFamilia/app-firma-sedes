/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // qrcode usa módulos de node; aseguramos que solo se use en el servidor.
  experimental: {
    serverComponentsExternalPackages: ["qrcode", "nodemailer", "bcryptjs"]
  }
};

export default nextConfig;
