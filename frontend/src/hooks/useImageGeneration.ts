import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface ImageGenerationOptions {
    prompt: string;
    size?: '1024x1024' | '1792x1024' | '1024x1792';
    quality?: 'standard' | 'hd';
    style?: 'vivid' | 'natural';
}

interface GeneratedImage {
    id: string;
    url: string;
    prompt: string;
    size: string;
    quality: string;
    style: string;
}

export function useImageGeneration() {
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [generatedImage, setGeneratedImage] = useState<GeneratedImage | null>(null);

    const generateImage = async (options: ImageGenerationOptions) => {
        setIsGenerating(true);
        setError(null);
        setGeneratedImage(null);

        try {
            // Get auth token
            const { data: { session } } = await supabase.auth.getSession();

            if (!session) {
                throw new Error('You must be logged in to generate images');
            }

            const response = await fetch('http://localhost:5000/api/images/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({
                    prompt: options.prompt,
                    size: options.size || '1024x1024',
                    quality: options.quality || 'standard',
                    style: options.style || 'vivid'
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to generate image');
            }

            const data = await response.json();

            if (data.success) {
                setGeneratedImage(data.image);
                return data.image;
            } else {
                throw new Error(data.error || 'Image generation failed');
            }
        } catch (err: any) {
            const errorMessage = err.message || 'An error occurred while generating the image';
            setError(errorMessage);
            throw err;
        } finally {
            setIsGenerating(false);
        }
    };

    const reset = () => {
        setGeneratedImage(null);
        setError(null);
    };

    return {
        generateImage,
        isGenerating,
        error,
        generatedImage,
        reset
    };
}
