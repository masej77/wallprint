export default {
  async fetch(request, env) {
    // Serve static files from ./public
    return env.ASSETS.fetch(request);
  }
};
