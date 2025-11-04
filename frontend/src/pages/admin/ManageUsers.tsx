import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, UserPlus, MoreHorizontal, Shield, User, Crown } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { apiClient } from '@/utils/apiClient';
import { useAuthStore } from '@/stores/authStore';
import supabase from '@/services/supabaseClient';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  subscription_plan: 'free' | 'plus' | 'pro';
  location?: string;
  bio?: string;
  phone?: string;
  website?: string;
  avatar_url?: string;
  company?: string;
  job_title?: string;
  social_links?: any;
  email_verified: boolean;
  is_active: boolean;
  last_login?: string;
  timezone?: string;
  language?: string;
  created_at: string;
  updated_at: string;
}

const ManageUsers: React.FC = () => {
  const { session, user, isAuthenticated } = useAuthStore();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddUser, setShowAddUser] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [planFilter, setPlanFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const usersPerPage = 10;

  useEffect(() => {
    console.log('🔍 ManageUsers: Component mounted, checking auth state...');
    console.log('🔍 ManageUsers: Current session:', !!session);
    console.log('🔍 ManageUsers: Current user:', user?.email);
    
    // Debug authentication state
    console.log('📦 Auth storage:', localStorage.getItem('auth-storage'));
    console.log('🔑 Supabase session:', localStorage.getItem('sb-localhost-auth-token') ? 'Present' : 'Missing');
    console.log('👤 Profile cache:', localStorage.getItem('userProfile'));
    
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await apiClient.get('/api/admin/users', {
        context: 'ManageUsers.fetchUsers'
      });
      
      const usersData = response.users || [];
      setUsers(usersData);
      
    } catch (error) {
      console.error('Error fetching users:', error);
      setError('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const updateUserRole = async (userId: string, newRole: string) => {
    try {
      await apiClient.patch(`/api/admin/users/${userId}/role`, 
        { role: newRole },
        { context: 'Update user role' }
      );
      
      setUsers(users.map(user => 
        user.id === userId ? { ...user, role: newRole as any } : user
      ));
      
      toast.success(`User role updated to ${newRole}`);
    } catch (error: any) {
      console.error('Error updating user role:', error);
      
      // Show more specific error message
      let errorMessage = 'Failed to update user role';
      if (error?.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      toast.error(errorMessage);
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin': return <Crown className="h-4 w-4" />;
      default: return <User className="h-4 w-4" />;
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin': return 'destructive';
      default: return 'outline';
    }
  };

  const filteredUsers = users.filter(user => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = user.email.toLowerCase().includes(searchLower) ||
                         user.name?.toLowerCase().includes(searchLower) ||
                         user.company?.toLowerCase().includes(searchLower) ||
                         user.job_title?.toLowerCase().includes(searchLower) ||
                         user.location?.toLowerCase().includes(searchLower) ||
                         user.phone?.toLowerCase().includes(searchLower);
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const matchesPlan = planFilter === 'all' || user.subscription_plan === planFilter;
    const matchesStatus = statusFilter === 'all' || 
                         (statusFilter === 'active' && user.is_active) ||
                         (statusFilter === 'inactive' && !user.is_active) ||
                         (statusFilter === 'verified' && user.email_verified) ||
                         (statusFilter === 'unverified' && !user.email_verified);
    return matchesSearch && matchesRole && matchesPlan && matchesStatus;
  });

  const totalPages = Math.ceil(filteredUsers.length / usersPerPage);
  const startIndex = (currentPage - 1) * usersPerPage;
  const paginatedUsers = filteredUsers.slice(startIndex, startIndex + usersPerPage);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-red-500 text-lg font-semibold mb-2">Error Loading Users</div>
          <div className="text-muted-foreground mb-4">{error}</div>
          <Button onClick={fetchUsers} variant="outline">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Manage Users</h1>
          <p className="text-muted-foreground">View and manage user accounts and permissions</p>
        </div>
        <Button onClick={() => setShowAddUser(true)}>
          <UserPlus className="mr-2 h-4 w-4" />
          Invite User
        </Button>
      </div>



      <Card>
        <CardHeader>
          <CardTitle>User Management</CardTitle>
          <CardDescription>
            Total users: {users.length} | Showing {paginatedUsers.length} of {filteredUsers.length}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search by name, email, company, job title, location, or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <div className="flex items-center space-x-4">
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="user">Users</SelectItem>
                  <SelectItem value="admin">Admins</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={planFilter} onValueChange={setPlanFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Plan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Plans</SelectItem>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="plus">Plus</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="verified">Verified</SelectItem>
                  <SelectItem value="unverified">Unverified</SelectItem>
                </SelectContent>
              </Select>
              
              <Button 
                variant="outline" 
                onClick={() => {
                  setSearchTerm('');
                  setRoleFilter('all');
                  setPlanFilter('all');
                  setStatusFilter('all');
                  setCurrentPage(1);
                }}
                className="whitespace-nowrap"
              >
                Clear Filters
              </Button>
            </div>
          </div>

          <div className="rounded-md border overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[200px]">User Info</TableHead>
                    <TableHead className="min-w-[150px]">Contact</TableHead>
                    <TableHead className="min-w-[150px]">Professional</TableHead>
                    <TableHead className="min-w-[120px]">Role & Plan</TableHead>
                    <TableHead className="min-w-[120px]">Status</TableHead>
                    <TableHead className="min-w-[180px]">Dates</TableHead>
                    <TableHead className="text-right min-w-[80px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
              <TableBody>
                {paginatedUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <div className="text-muted-foreground">
                        {users.length === 0 ? 'No users found' : 'No users match the current filters'}
                      </div>
                      {users.length === 0 && (
                        <Button onClick={fetchUsers} variant="outline" className="mt-2">
                          Refresh
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ) : 
                  paginatedUsers.map((user) => (
                    <TableRow key={user.id}>
                    {/* User Info */}
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium">{user.name || 'No name'}</div>
                        <div className="text-sm text-muted-foreground">{user.email}</div>
                        {user.bio && (
                          <div className="text-xs text-muted-foreground max-w-[200px] truncate" title={user.bio}>
                            {user.bio}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    
                    {/* Contact */}
                    <TableCell>
                      <div className="space-y-1 text-sm">
                        {user.phone && (
                          <div className="text-muted-foreground">{user.phone}</div>
                        )}
                        {user.location && (
                          <div className="text-muted-foreground">{user.location}</div>
                        )}
                        {user.website && (
                          <a 
                            href={user.website} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline text-xs"
                          >
                            Website
                          </a>
                        )}
                      </div>
                    </TableCell>
                    
                    {/* Professional */}
                    <TableCell>
                      <div className="space-y-1 text-sm">
                        {user.company && (
                          <div className="font-medium">{user.company}</div>
                        )}
                        {user.job_title && (
                          <div className="text-muted-foreground">{user.job_title}</div>
                        )}
                      </div>
                    </TableCell>
                    
                    {/* Role & Plan */}
                    <TableCell>
                      <div className="space-y-2">
                        <Badge variant={getRoleBadgeVariant(user.role)} className="flex items-center gap-1 w-fit">
                          {getRoleIcon(user.role)}
                          {user.role}
                        </Badge>
                        <Badge variant="outline" className="capitalize">
                          {user.subscription_plan}
                        </Badge>
                      </div>
                    </TableCell>
                    
                    {/* Status */}
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${user.is_active ? 'bg-green-500' : 'bg-red-500'}`}></div>
                          <span className="text-sm">{user.is_active ? 'Active' : 'Inactive'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${user.email_verified ? 'bg-blue-500' : 'bg-yellow-500'}`}></div>
                          <span className="text-sm">{user.email_verified ? 'Verified' : 'Unverified'}</span>
                        </div>
                        {user.language && (
                          <div className="text-xs text-muted-foreground">{user.language.toUpperCase()}</div>
                        )}
                      </div>
                    </TableCell>
                    
                    {/* Dates */}
                    <TableCell>
                      <div className="space-y-1 text-sm">
                        <div>
                          <div className="text-xs text-muted-foreground">Joined</div>
                          <div>{formatDate(user.created_at)}</div>
                        </div>
                        {user.last_login && (
                          <div>
                            <div className="text-xs text-muted-foreground">Last Login</div>
                            <div>{formatDate(user.last_login)}</div>
                          </div>
                        )}
                        <div>
                          <div className="text-xs text-muted-foreground">Updated</div>
                          <div>{formatDate(user.updated_at)}</div>
                        </div>
                      </div>
                    </TableCell>
                    
                    {/* Actions */}
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => updateUserRole(user.id, 'user')}>
                            Set as User
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => updateUserRole(user.id, 'admin')}>
                            Set as Admin
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              }
              </TableBody>
            </Table>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between mt-6 gap-4">
            <div className="text-sm text-muted-foreground">
              Showing {startIndex + 1}-{Math.min(startIndex + usersPerPage, filteredUsers.length)} of {filteredUsers.length} users
              {filteredUsers.length !== users.length && (
                <span className="ml-2 text-xs">
                  (filtered from {users.length} total)
                </span>
              )}
            </div>
            
            {totalPages > 1 && (
              <div className="flex items-center space-x-2">
                <div className="text-sm text-muted-foreground mr-4">
                  Page {currentPage} of {totalPages}
                </div>
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
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ManageUsers;