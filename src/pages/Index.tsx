import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import Icon from '@/components/ui/icon';

const API_URL = 'https://functions.poehali.dev/453139a2-6cbd-4623-a97e-53270c9c60bf';

interface User {
  id: number;
  username: string;
  is_admin?: boolean;
}

interface Video {
  id: number;
  user_id: number;
  title: string;
  youtube_url: string;
  youtube_id: string;
  likes: number;
  dislikes: number;
  views: number;
  created_at: string;
  username: string;
}

interface UserListItem {
  id: number;
  username: string;
  is_admin: boolean;
  created_at: string;
  videos_count: number;
  comments_count: number;
}

interface Comment {
  id: number;
  video_id: number;
  user_id: number;
  comment_text: string;
  created_at: string;
  username: string;
}

const Index = () => {
  const [user, setUser] = useState<User | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [showAuth, setShowAuth] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [showUsers, setShowUsers] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [usersList, setUsersList] = useState<UserListItem[]>([]);
  const { toast } = useToast();

  const [authForm, setAuthForm] = useState({ username: '', password: '' });
  const [uploadForm, setUploadForm] = useState({ title: '', youtube_url: '' });
  const [commentText, setCommentText] = useState('');

  useEffect(() => {
    const savedUser = localStorage.getItem('fyrch_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    loadVideos();
  }, []);

  const loadVideos = async () => {
    try {
      const res = await fetch(`${API_URL}?action=videos`);
      const data = await res.json();
      setVideos(data.videos || []);
    } catch (err) {
      toast({ title: 'Ошибка загрузки видео', variant: 'destructive' });
    }
  };

  const loadComments = async (videoId: number) => {
    try {
      const res = await fetch(`${API_URL}?action=comments&video_id=${videoId}`);
      const data = await res.json();
      setComments(data.comments || []);
    } catch (err) {
      toast({ title: 'Ошибка загрузки комментариев', variant: 'destructive' });
    }
  };

  const handleAuth = async () => {
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: isLogin ? 'login' : 'register',
          ...authForm
        })
      });
      const data = await res.json();
      
      if (data.success) {
        setUser(data.user);
        localStorage.setItem('fyrch_user', JSON.stringify(data.user));
        setShowAuth(false);
        toast({ title: isLogin ? 'Добро пожаловать!' : 'Регистрация успешна!' });
      } else {
        toast({ title: data.error || 'Ошибка авторизации', variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'Ошибка подключения', variant: 'destructive' });
    }
  };

  const handleUpload = async () => {
    if (!user) return;
    
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'upload',
          user_id: user.id,
          ...uploadForm
        })
      });
      const data = await res.json();
      
      if (data.success) {
        setShowUpload(false);
        setUploadForm({ title: '', youtube_url: '' });
        loadVideos();
        toast({ title: 'Видео загружено!' });
      }
    } catch (err) {
      toast({ title: 'Ошибка загрузки', variant: 'destructive' });
    }
  };

  const handleReact = async (videoId: number, reaction: 'like' | 'dislike') => {
    if (!user) {
      toast({ title: 'Войдите для реакции', variant: 'destructive' });
      return;
    }
    
    try {
      const res = await fetch(API_URL, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'react',
          video_id: videoId,
          user_id: user.id,
          reaction
        })
      });
      const data = await res.json();
      
      if (data.success) {
        setVideos(videos.map(v => v.id === videoId ? 
          { ...v, likes: data.likes, dislikes: data.dislikes } : v
        ));
      }
    } catch (err) {
      toast({ title: 'Ошибка реакции', variant: 'destructive' });
    }
  };

  const handleComment = async () => {
    if (!user || !selectedVideo) return;
    
    try {
      await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'comment',
          video_id: selectedVideo.id,
          user_id: user.id,
          comment_text: commentText
        })
      });
      
      setCommentText('');
      loadComments(selectedVideo.id);
      toast({ title: 'Комментарий добавлен!' });
    } catch (err) {
      toast({ title: 'Ошибка отправки', variant: 'destructive' });
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('fyrch_user');
    toast({ title: 'Вы вышли из аккаунта' });
  };

  const handleDeleteVideo = async (videoId: number) => {
    if (!user?.is_admin) return;
    
    try {
      const res = await fetch(API_URL, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete_video',
          user_id: user.id,
          video_id: videoId
        })
      });
      const data = await res.json();
      
      if (data.success) {
        setVideos(videos.filter(v => v.id !== videoId));
        if (selectedVideo?.id === videoId) {
          setSelectedVideo(null);
        }
        toast({ title: 'Видео удалено' });
      }
    } catch (err) {
      toast({ title: 'Ошибка удаления', variant: 'destructive' });
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    if (!user?.is_admin) return;
    
    try {
      const res = await fetch(API_URL, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete_comment',
          user_id: user.id,
          comment_id: commentId
        })
      });
      const data = await res.json();
      
      if (data.success) {
        setComments(comments.filter(c => c.id !== commentId));
        toast({ title: 'Комментарий удален' });
      }
    } catch (err) {
      toast({ title: 'Ошибка удаления', variant: 'destructive' });
    }
  };

  const openVideo = async (video: Video) => {
    setSelectedVideo(video);
    loadComments(video.id);
    
    try {
      await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'increment_view',
          video_id: video.id
        })
      });
      
      setVideos(videos.map(v => v.id === video.id ? { ...v, views: v.views + 1 } : v));
    } catch (err) {
      console.error('View increment error:', err);
    }
  };

  const loadUsers = async () => {
    try {
      const res = await fetch(`${API_URL}?action=users`);
      const data = await res.json();
      setUsersList(data.users || []);
      setShowUsers(true);
    } catch (err) {
      toast({ title: 'Ошибка загрузки пользователей', variant: 'destructive' });
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!user?.is_admin) return;
    
    try {
      const res = await fetch(API_URL, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete_user',
          user_id: user.id,
          delete_user_id: userId
        })
      });
      const data = await res.json();
      
      if (data.success) {
        setUsersList(usersList.filter(u => u.id !== userId));
        toast({ title: 'Пользователь удалён' });
      }
    } catch (err) {
      toast({ title: 'Ошибка удаления', variant: 'destructive' });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-gradient-to-r from-primary via-secondary to-accent shadow-lg">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-white flex items-center gap-2">
            <span className="text-4xl">📺</span> ФырчТуб
          </h1>
          
          <div className="flex gap-3">
            {user ? (
              <>
                <Dialog open={showUpload} onOpenChange={setShowUpload}>
                  <DialogTrigger asChild>
                    <Button className="bg-white text-primary hover:bg-gray-100">
                      <Icon name="Upload" size={18} className="mr-2" />
                      Загрузить видео
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Загрузить видео с YouTube</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 mt-4">
                      <Input
                        placeholder="Название видео"
                        value={uploadForm.title}
                        onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
                      />
                      <Input
                        placeholder="Ссылка на YouTube"
                        value={uploadForm.youtube_url}
                        onChange={(e) => setUploadForm({ ...uploadForm, youtube_url: e.target.value })}
                      />
                      <Button onClick={handleUpload} className="w-full">Загрузить</Button>
                    </div>
                  </DialogContent>
                </Dialog>
                
                <div className="flex items-center gap-3">
                  <Button onClick={loadUsers} variant="outline" className="bg-white/20 text-white border-white hover:bg-white/30">
                    <Icon name="Users" size={18} className="mr-2" />
                    Пользователи
                  </Button>
                  <span className="text-white font-medium">{user.username}</span>
                  <Button onClick={handleLogout} variant="outline" className="bg-white/20 text-white border-white hover:bg-white/30">
                    Выйти
                  </Button>
                </div>
              </>
            ) : (
              <Dialog open={showAuth} onOpenChange={setShowAuth}>
                <DialogTrigger asChild>
                  <Button className="bg-white text-primary hover:bg-gray-100">
                    <Icon name="LogIn" size={18} className="mr-2" />
                    Войти
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{isLogin ? 'Вход' : 'Регистрация'}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <Input
                      placeholder="Никнейм"
                      value={authForm.username}
                      onChange={(e) => setAuthForm({ ...authForm, username: e.target.value })}
                    />
                    <Input
                      type="password"
                      placeholder="Пароль"
                      value={authForm.password}
                      onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                    />
                    <Button onClick={handleAuth} className="w-full">
                      {isLogin ? 'Войти' : 'Зарегистрироваться'}
                    </Button>
                    <p className="text-center text-sm">
                      {isLogin ? 'Нет аккаунта?' : 'Уже есть аккаунт?'}
                      <button
                        onClick={() => setIsLogin(!isLogin)}
                        className="ml-2 text-primary hover:underline font-medium"
                      >
                        {isLogin ? 'Регистрация' : 'Войти'}
                      </button>
                    </p>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {videos.length === 0 ? (
          <div className="text-center py-20">
            <Icon name="VideoOff" size={64} className="mx-auto text-muted-foreground mb-4" />
            <h2 className="text-2xl font-semibold mb-2">Пока нет видео</h2>
            <p className="text-muted-foreground">Станьте первым, кто загрузит видео!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {videos.map((video) => (
              <Card key={video.id} className="overflow-hidden hover:shadow-xl transition-shadow cursor-pointer group">
                <div onClick={() => openVideo(video)}>
                  <div className="relative aspect-video bg-muted overflow-hidden">
                    <img
                      src={`https://img.youtube.com/vi/${video.youtube_id}/hqdefault.jpg`}
                      alt={video.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                    <div className="absolute inset-0 bg-black/30 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                      <Icon name="Play" size={48} className="text-white" />
                    </div>
                  </div>
                  <CardContent className="p-4">
                    <h3 className="font-semibold text-lg mb-2 line-clamp-2">{video.title}</h3>
                    <p className="text-sm text-muted-foreground mb-1">@{video.username}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Icon name="Eye" size={14} />
                      {video.views || 0} просмотров
                    </p>
                  </CardContent>
                </div>
                <div className="px-4 pb-4 flex gap-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleReact(video.id, 'like')}
                    className="flex-1"
                  >
                    <Icon name="ThumbsUp" size={16} className="mr-1" />
                    {video.likes}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleReact(video.id, 'dislike')}
                    className="flex-1"
                  >
                    <Icon name="ThumbsDown" size={16} className="mr-1" />
                    {video.dislikes}
                  </Button>
                  {user?.is_admin && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteVideo(video.id)}
                    >
                      <Icon name="Trash2" size={16} />
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>

      <Dialog open={!!selectedVideo} onOpenChange={() => setSelectedVideo(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          {selectedVideo && (
            <div className="space-y-4">
              <div className="aspect-video w-full">
                <iframe
                  width="100%"
                  height="100%"
                  src={`https://www.youtube.com/embed/${selectedVideo.youtube_id}`}
                  title={selectedVideo.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="rounded-lg"
                />
              </div>
              
              <div>
                <h2 className="text-2xl font-bold mb-2">{selectedVideo.title}</h2>
                <p className="text-muted-foreground mb-1">@{selectedVideo.username}</p>
                <p className="text-sm text-muted-foreground flex items-center gap-1 mb-4">
                  <Icon name="Eye" size={16} />
                  {selectedVideo.views || 0} просмотров
                </p>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => handleReact(selectedVideo.id, 'like')}
                  >
                    <Icon name="ThumbsUp" size={18} className="mr-2" />
                    {selectedVideo.likes}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleReact(selectedVideo.id, 'dislike')}
                  >
                    <Icon name="ThumbsDown" size={18} className="mr-2" />
                    {selectedVideo.dislikes}
                  </Button>
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-semibold text-lg mb-4">Комментарии ({comments.length})</h3>
                
                {user && (
                  <div className="flex gap-2 mb-4">
                    <Textarea
                      placeholder="Написать комментарий..."
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      className="flex-1"
                    />
                    <Button onClick={handleComment}>
                      <Icon name="Send" size={18} />
                    </Button>
                  </div>
                )}

                <div className="space-y-3">
                  {comments.map((comment) => (
                    <div key={comment.id} className="bg-muted p-3 rounded-lg flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-medium text-sm mb-1">@{comment.username}</p>
                        <p className="text-sm">{comment.comment_text}</p>
                      </div>
                      {user?.is_admin && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteComment(comment.id)}
                          className="ml-2 text-destructive hover:text-destructive"
                        >
                          <Icon name="Trash2" size={16} />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showUsers} onOpenChange={setShowUsers}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Пользователи ФырчТуб</DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            <div className="space-y-3">
              {usersList.map((listUser) => (
                <div key={listUser.id} className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold">@{listUser.username}</p>
                      {listUser.is_admin && (
                        <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded">
                          ADMIN
                        </span>
                      )}
                    </div>
                    <div className="flex gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Icon name="Video" size={14} />
                        {listUser.videos_count} видео
                      </span>
                      <span className="flex items-center gap-1">
                        <Icon name="MessageSquare" size={14} />
                        {listUser.comments_count} комментариев
                      </span>
                    </div>
                  </div>
                  {user?.is_admin && !listUser.is_admin && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteUser(listUser.id)}
                    >
                      <Icon name="Trash2" size={16} className="mr-2" />
                      Удалить
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Index;