import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Plus, Search, MoreHorizontal, Edit, Trash2, Eye, Upload, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/utils/apiClient';

interface BackgroundImage {
  id: string;
  name: string;
  description?: string;
  url: string;
  thumbnail_url?: string;
  category: string;
  tier_required: 'free' | 'plus' | 'pro';
  is_active: boolean;
  created_at: string;
  updated_at: string;
  usage_count?: number;
}

const ManageBackgroundImages: React.FC = () => {
  const [images, setImages] = useState<BackgroundImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingImage, setEditingImage] = useState<BackgroundImage | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const imagesPerPage = 12;

  const [newImage, setNewImage] = useState<{
    name: string;
    description: string;
    url: string;
    category: string;
    tier_required: 'free' | 'plus' | 'pro';
  }>({
    name: '',
    description: '',
    url: '',
    category: '',
    tier_required: 'free'
  });

  const categories = ['nature', 'abstract', 'minimal', 'gradient', 'texture', 'space', 'urban', 'artistic'];
  const tiers = ['free', 'plus', 'pro'];

  useEffect(() => {
    fetchBackgroundImages();
  }, []);

  const fetchBackgroundImages = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get('/api/admin/background-images');
      setImages(data.images || []);
    } catch (error) {
      console.error('Error fetching background images:', error);
      toast.error('Failed to load background images');
    } finally {
      setLoading(false);
    }
  };

  const handleEditImage = (image: BackgroundImage) => {
    setEditingImage(image);
    setNewImage({
      name: image.name,
      description: image.description || '',
      url: image.url,
      category: image.category,
      tier_required: image.tier_required
    });
    setIsAddModalOpen(true);
  };

  const handleAddImage = async () => {
    try {
      if (editingImage) {
        // Update existing image
        const data = await apiClient.patch(`/api/admin/background-images/${editingImage.id}`, newImage);
        setImages(images.map(img => img.id === editingImage.id ? { ...img, ...newImage } : img));
        toast.success('Background image updated successfully');
      } else {
        // Add new image
        const data = await apiClient.post('/api/admin/background-images', newImage);
        setImages([...images, data.image]);
        toast.success('Background image added successfully');
      }
      
      setNewImage({ name: '', description: '', url: '', category: '', tier_required: 'free' });
      setEditingImage(null);
      setIsAddModalOpen(false);
    } catch (error) {
      console.error('Error saving background image:', error);
      toast.error(editingImage ? 'Failed to update background image' : 'Failed to add background image');
    }
  };

  const handleUpdateImage = async (imageId: string, updates: Partial<BackgroundImage>) => {
    try {
      await apiClient.patch(`/api/admin/background-images/${imageId}`, updates);
      
      setImages(images.map(img => 
        img.id === imageId ? { ...img, ...updates } : img
      ));
      
      toast.success('Background image updated successfully');
    } catch (error) {
      console.error('Error updating background image:', error);
      toast.error('Failed to update background image');
    }
  };

  const handleDeleteImage = async (imageId: string) => {
    if (!confirm('Are you sure you want to delete this background image?')) {
      return;
    }

    try {
      await apiClient.delete(`/api/admin/background-images/${imageId}`);
      
      setImages(images.filter(img => img.id !== imageId));
      toast.success('Background image deleted successfully');
    } catch (error) {
      console.error('Error deleting background image:', error);
      toast.error('Failed to delete background image');
    }
  };

  const getTierBadgeVariant = (tier: string) => {
    switch (tier) {
      case 'pro': return 'destructive';
      case 'plus': return 'secondary';
      default: return 'outline';
    }
  };

  const filteredImages = images.filter(image => {
    const matchesSearch = image.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         image.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || image.category === categoryFilter;
    const matchesTier = tierFilter === 'all' || image.tier_required === tierFilter;
    return matchesSearch && matchesCategory && matchesTier;
  });

  const totalPages = Math.ceil(filteredImages.length / imagesPerPage);
  const startIndex = (currentPage - 1) * imagesPerPage;
  const paginatedImages = filteredImages.slice(startIndex, startIndex + imagesPerPage);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Manage Background Images</h1>
          <p className="text-muted-foreground">Add, edit, and organize background images for the chat interface</p>
        </div>
        <Dialog open={isAddModalOpen} onOpenChange={(open) => {
          setIsAddModalOpen(open);
          if (!open) {
            setEditingImage(null);
            setNewImage({ name: '', description: '', url: '', category: '', tier_required: 'free' });
          }
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Background
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{editingImage ? 'Edit Background Image' : 'Add New Background Image'}</DialogTitle>
              <DialogDescription>
                {editingImage ? 'Update the background image details.' : 'Add a new background image to the collection.'}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={newImage.name}
                  onChange={(e) => setNewImage({ ...newImage, name: e.target.value })}
                  placeholder="Enter image name"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={newImage.description}
                  onChange={(e) => setNewImage({ ...newImage, description: e.target.value })}
                  placeholder="Enter image description"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="url">Image URL</Label>
                <Input
                  id="url"
                  value={newImage.url}
                  onChange={(e) => setNewImage({ ...newImage, url: e.target.value })}
                  placeholder="https://example.com/image.jpg"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="category">Category</Label>
                <Select value={newImage.category} onValueChange={(value) => setNewImage({ ...newImage, category: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(category => (
                      <SelectItem key={category} value={category}>
                        {category.charAt(0).toUpperCase() + category.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="tier">Required Tier</Label>
                <Select value={newImage.tier_required} onValueChange={(value: any) => setNewImage({ ...newImage, tier_required: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select tier" />
                  </SelectTrigger>
                  <SelectContent>
                    {tiers.map(tier => (
                      <SelectItem key={tier} value={tier}>
                        {tier.charAt(0).toUpperCase() + tier.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" onClick={handleAddImage}>
                {editingImage ? 'Update Background' : 'Add Background'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Background Image Library</CardTitle>
          <CardDescription>
            Total images: {images.length} | Showing {paginatedImages.length} of {filteredImages.length}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search backgrounds by name or description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(category => (
                  <SelectItem key={category} value={category}>
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={tierFilter} onValueChange={setTierFilter}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Tier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tiers</SelectItem>
                {tiers.map(tier => (
                  <SelectItem key={tier} value={tier}>
                    {tier.charAt(0).toUpperCase() + tier.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {paginatedImages.map((image) => (
              <Card key={image.id} className="overflow-hidden">
                <div className="aspect-video relative bg-muted">
                  {image.url ? (
                    <img
                      src={image.thumbnail_url || image.url}
                      alt={image.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        target.nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                  ) : null}
                  <div className="hidden absolute inset-0 flex items-center justify-center">
                    <ImageIcon className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <div className="absolute top-2 right-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="secondary" size="sm" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => window.open(image.url, '_blank')}>
                          <Eye className="mr-2 h-4 w-4" />
                          View Full Size
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleEditImage(image)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDeleteImage(image.id)} className="text-destructive">
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                <CardContent className="p-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold truncate">{image.name}</h3>
                      <Badge variant={image.is_active ? 'default' : 'secondary'} className="text-xs">
                        {image.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    {image.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">{image.description}</p>
                    )}
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-xs">
                        {image.category}
                      </Badge>
                      <Badge variant={getTierBadgeVariant(image.tier_required)} className="text-xs">
                        {image.tier_required}
                      </Badge>
                    </div>
                    {image.usage_count !== undefined && (
                      <p className="text-xs text-muted-foreground">
                        Used {image.usage_count} times
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <div className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ManageBackgroundImages;