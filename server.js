import express from 'express';
const app = express();
const port = process.env.PORT || 8080;
import dotenv from 'dotenv';
dotenv.config();

import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import cors  from 'cors';
import mammoth from 'mammoth';
import OpenAI from "openai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


app.use(cors());
const upload = multer({ dest: 'uploads/' });
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*'); // 允许所有域名访问
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});

// 读取 prompt.txt 文件内容
const promptFilePath = path.join(__dirname, 'prompt.txt');
let promptContent = '';
try {
  promptContent = fs.readFileSync(promptFilePath, 'utf8');
  // console.log('Successfully read prompt.txt:', promptContent.slice(0, 50) + '...');
} catch (err) {
  console.error('Error reading prompt.txt:', err);
  // 可以选择返回错误或使用默认提示
}

// console.log(promptContent);

app.get('/test', async(req, res) => {
  res.send('hello world');
})

const apiKey = process.env.apiKey;
console.log(apiKey)


app.post('/upload', upload.single('file'), async(req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded.');
  }
  const filePath = path.join(__dirname, req.file.path);
  const result = await mammoth.extractRawText({ path: req.file.path });
  const text = result.value; // 提取的需要分析的文本内容

  // 打印文本
  console.log('提取的文本内容：\n', text.slice(0,50) + "...");
  
  const openai = new OpenAI(
      {
          // 若没有配置环境变量，请用阿里云百炼API Key将下行替换为：apiKey: "sk-xxx",
          apiKey: apiKey,
          baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1"
      }
  );
  console.log("开始分析————————————————————————")

  const completion = await openai.chat.completions.create({
      model: "qwen-plus",  // 此处以 deepseek-r1 为例，可按需更换模型名称。
      stream: true,
      stream_options: {
          include_usage: true
      },
      messages: [
          {
            role: "user",
            content: promptContent + "\n\n以下是需要你理解的文本内容：\n" + text // 将 prompt 内容和提取的文本结合
          }
      ],
  });
  let fullContent = "";
  console.log("流式输出内容为：")
  for await (const chunk of completion) {
      // 如果stream_options.include_usage为true，则最后一个chunk的choices字段为空数组，需要跳过（可以通过chunk.usage获取 Token 使用量）
      if (Array.isArray(chunk.choices) && chunk.choices.length > 0) {
          fullContent = fullContent + chunk.choices[0].delta.content;
          console.log(chunk.choices[0].delta.content);
      }
  }
  console.log("\n完整内容为：")
  console.log(fullContent);
  res.send(fullContent);

});

app.listen(port, () => {
  console.log(`Backend server listening at http://localhost:${port}`);
});