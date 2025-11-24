import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Image as ImageIcon, Loader2, Download, X, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useImageGeneration } from '@/hooks/useImageGeneration';
import { cn } from '@/lib/utils';

export function ImageGenerationDialog() {
    const [open, setOpen] = useState(false);
    const [prompt, setPrompt] = useState('');
    const [size, setSize] = useState<'1024x1024' | '1792x1024' | '1024x1792'>('1024x1024');
    const [quality, setQuality] = useState<'standard' | 'hd'>('standard');
    const [style, setStyle] = useState<'vivid' | 'natural'>('vivid');

    const { generateImage, isGenerating, error, generatedImage, reset } = useImageGeneration();

    const handleGenerate = async () => {
        if (!prompt.trim()) return;

        try {
            await generateImage({ prompt, size, quality, style });
        } catch (err) {
            // Error is handled by the hook
            console.error('Image generation failed:', err);
        }
    };

    const handleDownload = () => {
        if (generatedImage) {
            const link = document.createElement('a');
            link.href = generatedImage.url;
            link.download = `${generatedImage.prompt.substring(0, 30)}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    const handleClose = () => {
        setOpen(false);
        reset();
        setPrompt('');
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    title="Generate image with DALL-E"
                >
                    <ImageIcon className="w-4 h-4" />
                    <span className="hidden sm:inline">Generate Image</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-purple-500" />
                        Generate Image with DALL-E
                    </DialogTitle>
                    <DialogDescription>
                        Create stunning images using AI. Describe what you want to see.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Prompt Input */}
                    <div className="space-y-2">
                        <Label htmlFor="prompt">Image Description</Label>
                        <Input
                            id="prompt"
                            placeholder="A serene mountain landscape at sunset with vibrant colors..."
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            disabled={isGenerating}
                            className="h-20"
                        />
                    </div>

                    {/* Options */}
                    <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="size">Size</Label>
                            <Select value={size} onValueChange={(v: any) => setSize(v)} disabled={isGenerating}>
                                <SelectTrigger id="size">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="1024x1024">Square (1024×1024)</SelectItem>
                                    <SelectItem value="1792x1024">Landscape (1792×1024)</SelectItem>
                                    <SelectItem value="1024x1792">Portrait (1024×1792)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="quality">Quality</Label>
                            <Select value={quality} onValueChange={(v: any) => setQuality(v)} disabled={isGenerating}>
                                <SelectTrigger id="quality">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="standard">Standard</SelectItem>
                                    <SelectItem value="hd">HD</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="style">Style</Label>
                            <Select value={style} onValueChange={(v: any) => setStyle(v)} disabled={isGenerating}>
                                <SelectTrigger id="style">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="vivid">Vivid</SelectItem>
                                    <SelectItem value="natural">Natural</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Error Display */}
                    <AnimatePresence>
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="p-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg text-sm"
                            >
                                {error}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Generated Image Display */}
                    <AnimatePresence>
                        {generatedImage && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                className="relative rounded-lg overflow-hidden border"
                            >
                                <img
                                    src={generatedImage.url}
                                    alt={generatedImage.prompt}
                                    className="w-full h-auto"
                                />
                                <div className="absolute top-2 right-2 flex gap-2">
                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        onClick={handleDownload}
                                        className="gap-2"
                                    >
                                        <Download className="w-4 h-4" />
                                        Download
                                    </Button>
                                </div>
                                <div className="p-3 bg-background/95 backdrop-blur">
                                    <p className="text-sm text-muted-foreground line-clamp-2">
                                        {generatedImage.prompt}
                                    </p>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Generate Button */}
                    <div className="flex gap-2 justify-end">
                        {generatedImage && (
                            <Button variant="outline" onClick={() => { reset(); setPrompt(''); }}>
                                Generate Another
                            </Button>
                        )}
                        <Button
                            onClick={handleGenerate}
                            disabled={!prompt.trim() || isGenerating}
                            className={cn(
                                'gap-2',
                                isGenerating && 'cursor-not-allowed'
                            )}
                        >
                            {isGenerating ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Generating...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="w-4 h-4" />
                                    Generate Image
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
