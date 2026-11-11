import { Link } from 'react-router';
import { Button } from '../components/ui';

export function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <p className="text-5xl font-bold text-brand-600">404</p>
      <h1 className="mt-2 text-lg font-semibold text-slate-900">Không tìm thấy trang</h1>
      <p className="mt-1 text-sm text-slate-500">Đường dẫn không tồn tại hoặc đã bị thay đổi.</p>
      <Link to="/" className="mt-5">
        <Button variant="outline">Về trang chủ</Button>
      </Link>
    </div>
  );
}
