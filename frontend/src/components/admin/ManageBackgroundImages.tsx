import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Save, 
  X, 
  Upload,
  Eye,
  EyeOff,
  Star,
  Users,
  Image as ImageIcon,
  AlertCircle,
  CheckCircle,
  FileImage
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { backgroundImageService, BackgroundImage } from '../../services/backgroundImageService';

interface BackgroundImageForm {
  name: string;
  description: string;
  url: string;
  thumbnail_url: string;
  category: string;
  tier_required: 'free' | 'plus' | 'pro';
  is_active: boolean;
  tags: string;
}

const CATEGORIES = [
  'nature', 'abstract', 'minimal', 'gradient', 
  'texture', 'space', 'urban', 'artistic', 'general'
];

const TIER_COLORS = {
  free: 'bg-green-100 text-green-800',
  plus: 'bg-blue-100 text-blue-800',
  pro: 'bg-purple-100 text-purple-800'
};

const ManageBackgroundImages: React.FC = () => {
  const { session } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<BackgroundImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editingImage, setEditingImage] = useState<BackgroundImage | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [formData, setFormData] = useState<BackgroundImageForm>({
    name: '',
    description: '',
    url: '',
    thumbnail_url: '',
    category: 'general',
    tier_required: 'free',
    is_active: true,
    tags: ''
  });

  useEffect(() => {
    fetchBackgroundImages();
  }, []);

  const fetchBackgroundImages = async () => {
    try {
      setLoading(true);
      const response = await backgroundImageService.getAllBackgroundImages();
      setImages(response.data.images || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch background images');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      backgroundImageService.validateImageFile(file);
      setSelectedFile(file);
      
      // Create preview URL
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      
      // Auto-fill name if empty
      if (!formData.name) {
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
        setFormData(prev => ({ ...prev, name: nameWithoutExt }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid file');
      setSelectedFile(null);
      setPreviewUrl(null);
    }
  };

  const handleUploadAndSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      if (selectedFile && !editingImage) {
        // Upload new file
        setUploading(true);
        setUploadProgress(0);
        
        const metadata = {
          name: formData.name,
          description: formData.description,
          category: formData.category,
          tier_required: formData.tier_required
        };

        const response = await backgroundImageService.uploadAndCreateBackgroundImage(selectedFile, metadata);
        setSuccess('Background image uploaded and created successfully!');
      } else if (editingImage) {
        // Update existing image
        const payload = {
          ...formData,
          tags: formData.tags.split(',').map(tag => tag.trim()).filter(Boolean)
        };
        
        await backgroundImageService.updateBackgroundImage(editingImage.id, payload);
        setSuccess('Background image updated successfully!');
      } else {
        // Create with URL
        const payload = {
          ...formData,
          tags: formData.tags.split(',').map(tag => tag.trim()).filter(Boolean)
        };
        
        await backgroundImageService.createBackgroundImage(payload);
        setSuccess('Background image created successfully!');
      }

      resetForm();
      fetchBackgroundImages();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operation failed');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleSubmit = handleUploadAndSubmit;

  const handleDelete = async (imageId: string) => {
    if (!confirm('Are you sure you want to delete this background image?')) {
      return;
    }

    try {
      await backgroundImageService.deleteBackgroundImage(imageId);
      setSuccess('Background image deleted successfully!');
      fetchBackgroundImages();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete background image');
    }
  };

  const handleEdit = (image: BackgroundImage) => {
    setEditingImage(image);
    setFormData({
      name: image.name,
      description: image.description || '',
      url: image.url,
      thumbnail_url: image.thumbnail_url || '',
      category: image.category,
      tier_required: image.tier_required,
      is_active: image.is_active,
      tags: image.tags?.join(', ') || ''
    });
    setShowAddForm(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      url: '',
      thumbnail_url: '',
      category: 'general',
      tier_required: 'free',
      is_active: true,
      tags: ''
    });
    setEditingImage(null);
    setShowAddForm(false);
    setSelectedFile(null);
    setPreviewUrl(null);
    setUploading(false);
    setUploadProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const toggleImageStatus = async (image: BackgroundImage) => {
    try {
      await backgroundImageService.updateBackgroundImage(image.id, {
        ...image,
        is_active: !image.is_active
      });
      fetchBackgroundImages();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update image status');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Background Images</h2>
          <p className="text-gray-600">Manage background images for user customization</p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Background
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-red-500" />
          <span className="text-red-700">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-green-500" />
          <span className="text-green-700">{success}</span>
          <button onClick={() => setSuccess(null)} className="ml-auto text-green-500 hover:text-green-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Add/Edit Form */}
      {showAddForm && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">
              {editingImage ? 'Edit Background Image' : 'Add New Background Image'}
            </h3>
            <button onClick={resetForm} className="text-gray-500 hover:text-gray-700">
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* File Upload Section */}
            {!editingImage && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Upload Image</label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  {previewUrl ? (
                    <div className="space-y-4">
                      <img
                        src={previewUrl}
                        alt="Preview"
                        className="max-h-32 mx-auto rounded-lg"
                      />
                      <div className="flex items-center justify-center gap-2">
                        <FileImage className="h-4 w-4 text-green-600" />
                        <span className="text-sm text-green-600">{selectedFile?.name}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedFile(null);
                            setPreviewUrl(null);
                            if (fileInputRef.current) fileInputRef.current.value = '';
                          }}
                          className="text-red-500 hover:text-red-700"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Upload className="h-8 w-8 text-gray-400 mx-auto" />
                      <div>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="text-blue-600 hover:text-blue-700 font-medium"
                        >
                          Choose file
                        </button>
                        <span className="text-gray-500"> or drag and drop</span>
                      </div>
                      <p className="text-xs text-gray-500">PNG, JPG, WebP up to 10MB</p>
                    </div>
                  )}
                </div>
                {selectedFile && (
                  <p className="text-sm text-gray-600 mt-2">
                    File will be uploaded to Cloudinary when you save the image.
                  </p>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="name">Name</label>
              <input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="category">Category</label>
              <select
                id="category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {CATEGORIES.map(category => (
                  <option key={category} value={category}>
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="description">Description</label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={2}
              />
            </div>

            {/* URL inputs - only show if no file selected or editing */}
            {(!selectedFile || editingImage) && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="url">Image URL</label>
                  <input
                    id="url"
                    type="url"
                    value={formData.url}
                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required={!selectedFile}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="thumbnail_url">Thumbnail URL (Optional)</label>
                  <input
                    id="thumbnail_url"
                    type="url"
                    value={formData.thumbnail_url}
                    onChange={(e) => setFormData({ ...formData, thumbnail_url: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="tier_required">Tier Required</label>
              <select
                id="tier_required"
                value={formData.tier_required}
                onChange={(e) => setFormData({ ...formData, tier_required: e.target.value as 'free' | 'plus' | 'pro' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="free">Free</option>
                <option value="plus">Plus</option>
                <option value="pro">Pro</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="tags">Tags (comma-separated)</label>
              <input
                id="tags"
                type="text"
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="nature, landscape, mountains"
              />
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="is_active" className="ml-2 block text-sm text-gray-700">
                Active (visible to users)
              </label>
            </div>

            {/* Upload Progress */}
            {uploading && (
              <div className="md:col-span-2">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Upload className="h-4 w-4 text-blue-600 animate-pulse" />
                    <span className="text-blue-700 font-medium">Uploading to Cloudinary...</span>
                  </div>
                  <div className="w-full bg-blue-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            )}

            <div className="md:col-span-2 flex gap-2">
              <button
                type="submit"
                disabled={uploading}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                  uploading 
                    ? 'bg-gray-400 text-white cursor-not-allowed' 
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {uploading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Uploading...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    {editingImage ? 'Update' : selectedFile ? 'Upload & Create' : 'Create'}
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={resetForm}
                disabled={uploading}
                className={`px-4 py-2 rounded-lg ${
                  uploading 
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                    : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
                }`}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Images Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {images.map((image) => (
          <div key={image.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
            {/* Image Preview */}
            <div className="relative h-32 bg-gray-100">
              <img
                src={image.thumbnail_url || image.url}
                alt={image.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjEyMCIgdmlld0JveD0iMCAwIDIwMCAxMjAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMTIwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik04NyA0OEw5MyA1NEw5OSA0OEwxMDUgNTRMMTEzIDQ2VjY2SDg3VjQ4WiIgZmlsbD0iIzlDQTNBRiIvPgo8L3N2Zz4K';
                }}
              />
              <div className="absolute top-2 right-2 flex gap-1">
                <span className={`px-2 py-1 text-xs rounded-full ${TIER_COLORS[image.tier_required]}`}>
                  {image.tier_required}
                </span>
                {!image.is_active && (
                  <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-600">
                    Inactive
                  </span>
                )}
              </div>
            </div>

            {/* Image Info */}
            <div className="p-4">
              <h3 className="font-semibold text-gray-900 truncate">{image.name}</h3>
              <p className="text-sm text-gray-600 truncate">{image.description}</p>
              <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                <span className="capitalize">{image.category}</span>
                <div className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {image.usage_count}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => handleEdit(image)}
                  className="flex-1 bg-blue-50 text-blue-600 px-3 py-1 rounded text-sm hover:bg-blue-100 flex items-center justify-center gap-1"
                >
                  <Edit className="h-3 w-3" />
                  Edit
                </button>
                <button
                  onClick={() => toggleImageStatus(image)}
                  className={`flex-1 px-3 py-1 rounded text-sm flex items-center justify-center gap-1 ${
                    image.is_active 
                      ? 'bg-yellow-50 text-yellow-600 hover:bg-yellow-100' 
                      : 'bg-green-50 text-green-600 hover:bg-green-100'
                  }`}
                >
                  {image.is_active ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  {image.is_active ? 'Hide' : 'Show'}
                </button>
                <button
                  onClick={() => handleDelete(image.id)}
                  className="flex-1 bg-red-50 text-red-600 px-3 py-1 rounded text-sm hover:bg-red-100 flex items-center justify-center gap-1"
                >
                  <Trash2 className="h-3 w-3" />
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {images.length === 0 && !loading && (
        <div className="text-center py-12">
          <ImageIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No background images</h3>
          <p className="text-gray-600 mb-4">Get started by adding your first background image.</p>
          <button
            onClick={() => setShowAddForm(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Add Background Image
          </button>
        </div>
      )}
    </div>
  );
};

export default ManageBackgroundImages;