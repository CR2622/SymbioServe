declare module '@google/genai' {
  export interface GenerateContentOptions {
    model: string
    contents: string | Array<unknown>
    config?: Record<string, unknown>
    [key: string]: unknown
  }

  export interface GenerateContentResponse {
    text?: string
    [key: string]: unknown
  }

  export class GoogleGenAI {
    constructor(options?: { apiKey?: string })
    models: {
      generateContent(options: GenerateContentOptions): Promise<GenerateContentResponse>
    }
  }
}
