import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { UserPlus, UserCheck } from 'lucide-react';
import { usersApi } from '../../api/endpoints';
import { Button } from '../ui';
import { useAuth } from '../../features/auth/AuthContext';

export function FollowButton({
  targetUserId,
  initialFollowing = false,
  onToggle,
}: {
  targetUserId: string;
  initialFollowing?: boolean;
  onToggle?: (isFollowing: boolean) => void;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [following, setFollowing] = useState(initialFollowing);

  useEffect(() => {
    setFollowing(initialFollowing);
  }, [initialFollowing]);

  const mutation = useMutation({
    mutationFn: (wantFollow: boolean) =>
      wantFollow ? usersApi.follow(targetUserId) : usersApi.unfollow(targetUserId),
    onMutate: (wantFollow) => {
      const prev = following;
      setFollowing(wantFollow);
      onToggle?.(wantFollow);
      return { prev };
    },
    onError: (_err, _wantFollow, ctx) => {
      const rollback = ctx?.prev ?? initialFollowing;
      setFollowing(rollback);
      onToggle?.(rollback);
    },
    onSuccess: (res) => {
      setFollowing(res.following);
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      void queryClient.invalidateQueries({ queryKey: ['posts'] });
    },
  });

  if (!user || user.id === targetUserId) return null;

  return (
    <Button
      variant={following ? 'outline' : 'primary'}
      size="sm"
      loading={mutation.isPending}
      onClick={() => mutation.mutate(!following)}
      icon={following ? <UserCheck className="size-3.5 text-brand-600" /> : <UserPlus className="size-3.5" />}
    >
      {following ? 'Đang theo dõi' : 'Theo dõi'}
    </Button>
  );
}
