import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, X, Link as LinkIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ImageUploadProps {
  onImageUploaded: (url: string) => void;
  currentImageUrl?: string | null;
  className?: string;
}

export const ImageUpload = ({ onImageUploaded, currentImageUrl, className }: ImageUploadProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentImageUrl !== undefined ? currentImageUrl : null);
  const [imageUrlInput, setImageUrlInput] = useState("");
  const [activeTab, setActiveTab] = useState<string>("url"); // Default to URL tab
  const { toast } = useToast();

  // Update the image URL when the input changes
  useEffect(() => {
    if (activeTab === "url" && imageUrlInput && isValidUrl(imageUrlInput)) {
      // Only update when field changes, not on every render
      const timer = setTimeout(() => validateAndSetImageUrl(imageUrlInput), 500);
      return () => clearTimeout(timer);
    }
  }, [imageUrlInput, activeTab]);

  const validateAndSetImageUrl = async (url: string) => {
    if (!url.trim()) return;

    try {
      // Simple URL validation
      if (!isValidUrl(url)) {
        return; // Silently fail - we'll validate on submit
      }

      // Test if the URL is an image by creating an image element
      const isValidImage = await testImageUrl(url);
      if (!isValidImage) {
        // Don't show errors during typing - we'll validate on submit
        return;
      }

      // If it's a valid image, set it as the image URL
      setPreviewUrl(url);
      onImageUploaded(url);
    } catch (error) {
      // Don't show errors during typing
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a JPEG, PNG, GIF, or WebP image.",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      toast({
        title: "File too large",
        description: "Please upload an image smaller than 5MB.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsUploading(true);

      // Create a preview URL
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setPreviewUrl(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);

      // Upload the image
      const formData = { image: await fileToBase64(file) };
      const response = await apiRequest("POST", "/api/upload/image", formData);
      const data = await response.json();

      if (response.ok) {
        onImageUploaded(data.url);
        toast({
          title: "Image uploaded",
          description: "Your image has been uploaded successfully.",
        });
      } else {
        throw new Error(data.message || "Failed to upload image");
      }
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload image",
        variant: "destructive",
      });
      // Reset preview if upload failed
      setPreviewUrl(currentImageUrl !== undefined ? currentImageUrl : null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleClearImage = () => {
    setPreviewUrl(null);
    onImageUploaded("");
    setImageUrlInput("");
  };

  const isValidUrl = (string: string) => {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  };

  const testImageUrl = (url: string): Promise<boolean> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = url;
    });
  };

  return (
    <div className={className}>
      <Label>Image (Optional)</Label>
      
      {previewUrl ? (
        <Card className="mt-1.5 relative overflow-hidden">
          <CardContent className="p-0">
            <img 
              src={previewUrl} 
              alt="Need preview" 
              className="w-full h-auto max-h-[200px] object-contain" 
            />
            <Button 
              type="button" 
              variant="destructive" 
              size="sm" 
              className="absolute top-2 right-2 rounded-full p-1 h-8 w-8"
              onClick={handleClearImage}
            >
              <X className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="url" className="mt-1.5" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="url">Image URL</TabsTrigger>
            <TabsTrigger value="upload">Upload Image</TabsTrigger>
          </TabsList>
          
          <TabsContent value="url" className="mt-2">
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Input
                  type="text"
                  placeholder="Enter image URL (https://example.com/image.jpg)"
                  value={imageUrlInput}
                  onChange={(e) => setImageUrlInput(e.target.value)}
                  disabled={isUploading}
                  className="flex-1"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Paste a direct link to an image (JPG, PNG, GIF, WebP). The image will be added when you submit the form.
              </p>
            </div>
          </TabsContent>
          
          <TabsContent value="upload" className="mt-2">
            <div className="relative">
              <Input
                id="image-upload"
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                disabled={isUploading}
                className="hidden"
              />
              <label 
                htmlFor="image-upload"
                className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-md cursor-pointer bg-background hover:bg-secondary/10 transition-colors"
              >
                {isUploading ? (
                  <div className="flex flex-col items-center justify-center">
                    <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
                    <span className="text-sm text-muted-foreground mt-2">Uploading...</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center">
                    <Upload className="w-8 h-8 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground mt-2">Click to upload image</span>
                  </div>
                )}
              </label>
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

// Helper function to convert a file to base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};