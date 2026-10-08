import { defineConfig } from 'vite';
import { createPhotoHandler } from './server/food-photo.js';
import { createAssistantHandler } from './server/assistant.js';
export default defineConfig({
  base: './',
  plugins: [{ name: 'chef-assistant-api', configureServer(server) { server.middlewares.use(createAssistantHandler()); server.middlewares.use(createPhotoHandler()); }, configurePreviewServer(server) { server.middlewares.use(createAssistantHandler()); server.middlewares.use(createPhotoHandler()); } }]
});
