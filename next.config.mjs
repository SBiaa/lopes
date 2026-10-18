/** @type {import('next').NextConfig} */
export default {
  // A tela de etiquetas é o arquivo estático public/index.html; serve na raiz.
  async rewrites() {
    return { beforeFiles: [{ source: "/", destination: "/index.html" }] };
  },
};
