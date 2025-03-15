const { Configuration, OpenAIApi } = require("openai");
console.log("keys:", Object.keys(require("openai")));

const configuration = new Configuration({
  apiKey: "fake-key"
});
const openai = new OpenAIApi(configuration);
console.log("Success!", openai);
