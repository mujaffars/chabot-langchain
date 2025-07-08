import { TextLoader } from "langchain/document_loaders/fs/text";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { OpenAIEmbeddings } from "@langchain/openai";
import dotenv from "dotenv";

dotenv.config();

export async function getRetriever() {
  const loader = new TextLoader("./data/faq.txt");
  const rawDocs = await loader.load();

  const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 500, chunkOverlap: 50 });
  const docs = await splitter.splitDocuments(rawDocs);

  const vectorStore = await MemoryVectorStore.fromDocuments(docs, new OpenAIEmbeddings());
  return vectorStore.asRetriever();
}
