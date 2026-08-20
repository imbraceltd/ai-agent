import { dynamicTool, tool, Tool } from 'ai';
import { z } from 'zod';

function randomWeather() {
  const weatherOptions = ['sunny', 'cloudy', 'rainy', 'windy'];
  return weatherOptions[Math.floor(Math.random() * weatherOptions.length)];
}

export const weatherToolWithApproval = tool({
  description: 'Get the weather in a location',
  inputSchema: z.object({ city: z.string() }),
  execute: async ({ city }) => {
    console.log(`Getting weather for ${city}`);
    return {
      status: 'success',
      data: {
        temperature: 72,
        weather: randomWeather(),
      },
    };
  },
});

