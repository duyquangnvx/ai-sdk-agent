import { createGoogleGenerativeAI } from '@ai-sdk/google';

const google = createGoogleGenerativeAI({
  apiKey: 'AIzaSyC9-Ftn8WRx5xOsE-Aj_I0tH-iS3kWZULo',
});

const model = google('gemini-2.5-pro');

export default model;