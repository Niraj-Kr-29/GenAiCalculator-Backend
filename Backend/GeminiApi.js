import express from 'express';
import bodyParser from 'body-parser';
import { GoogleGenerativeAI, } from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/server'
import dotenv from 'dotenv';
import cors from 'cors';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs'
import { fileURLToPath } from 'url';


dotenv.config();

const app = express();
app.use(bodyParser.json({ limit: '50mb' }));
app.use(cors({origin: 'https://gen-ai-calculator.vercel.app'}))


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const genAI = new GoogleGenerativeAI(process.env.API_KEY);
const fileManager = new GoogleAIFileManager(process.env.API_KEY);

const prompt = 'Analyse the image and provide a short and concise description or solution of the problem.If it is a theoretical question or demanding a theoretical response then respond with a short description and if the problem contains any mathematical or computational solution then respond with the solution. Before the response you can provide a short description of the problem.If the problem is not related to mathematics or computational science then respond with a short description of the problem. Strictly keep in mind that the whole response is not very lengthy, keep it short and concise. The format should be something like this - Problem: very short description -> line change Solution: very short solution description -> line change Final Answer: Direct answer';

app.post('/api/calculate', async (req, res) => {
    try {
        const { image } = req.body;
        if (!image) {
            return res.status(400).json({ message: "Image data is missing" });
        }

        const base64Data = image.split(',')[1]; // Assumes data:image/png;base64,<data>
        const imageBuffer = Buffer.from(base64Data, 'base64');
        const imagePath = path.join(__dirname, 'uploaded-image.jpg');

        // Convert image buffer to sharp instance
        await sharp(imageBuffer).jpeg().toFile(imagePath);
        await sharp(imageBuffer).toFile('backend-processed-output.png');

        const uploadResult = await fileManager.uploadFile(imagePath, {
            mimeType: 'image/jpeg',
            displayName: 'Uploaded Image',
        });
        
        console.log(
            `Uploaded file ${uploadResult.file.displayName} as: ${uploadResult.file.uri}`
        );

        fs.unlink(imagePath, (err) => {
            if (err) console.error('Failed to delete local image:', err);
        });
        
        // console.log("Base64 Data:", base64Data);
        //console.log("Image Buffer:", imageBuffer);

        // Send to Gemini
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const response = await model.generateContent([
            prompt,
            {
                fileData: {
                    fileUri: uploadResult.file.uri,
                    mimeType: uploadResult.file.mimeType,
                },
            },
        ]);

        res.json({ result:  response.response.candidates[0].content.parts[0].text });
        console.log('Full Response:', response.response.candidates[0].content.parts[0].text);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Something went wrong');
    }
});

const PORT = 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
