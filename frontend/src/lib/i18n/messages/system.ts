// Text of the system pages: 403 / 404 / 500, "not found" boxes, loading screens and the embed viewer.
// Every key needs an English and a Thai text; TypeScript fails if `th` misses one. Placeholders: `{name}`.
export const systemEn = {
  'sys.backHome': 'Back to home',
  'sys.backToGallery': 'Back to gallery',
  'sys.tryAgain': 'Try again',

  'sys.403.meta': '403 Access Denied — Lixyte',
  'sys.403.label': '[ 403 · Access denied ]',
  'sys.403.title': 'Forbidden',
  'sys.403.body': "You don't have permission to access this page or resource. Please sign in with an authorized account or return to the gallery.",
  'sys.403.signIn': 'Sign in',

  'sys.404.meta': '404 Not Found — Lixyte',
  'sys.404.label': '[ 404 · Not found ]',
  'sys.404.title': 'Page not found',
  'sys.404.body': 'The page or 3D model you are looking for does not exist, was removed, or has been moved to another address.',
  'sys.404.explore': 'Explore gallery',

  'sys.500.label': '[ 500 · System error ]',
  'sys.500.title': 'Something went wrong',
  'sys.500.body': 'An unexpected error occurred while loading this page. Please try again or return to the home page.',
  'sys.500.errorId': 'Error ID: {id}',

  'sys.galleryError': "Couldn't load models. Please try again.",
  'sys.modelNotFound': 'That model does not exist or was removed.',
  'sys.creatorNotFound': 'That creator does not exist.',

  'loader.label': '[ Loading · Lixyte ]',
  'loader.message': 'Syncing 3D asset stream…',
  'loader.gallery': 'Loading gallery',
  'loader.gallerySync': '[ Syncing 3D library… ]',
  'loader.model': 'Loading model details',
  'loader.modelSync': '[ Connecting 3D stream… ]',
  'loader.description': '[ Description ]',
  'loader.howToUse': '[ How to use ]',
  'loader.page': 'Loading page',
  'loader.navigating': '[ Navigating · Lixyte ]',
  'loader.view': 'Loading view…',

  'embed.loading': 'Loading 3D viewer…',
  'embed.unavailable': '3D model unavailable on CDN',
  'embed.previewOnly': 'Purchase required · showing the preview file',
} as const;

export const systemTh: Record<keyof typeof systemEn, string> = {
  'sys.backHome': 'กลับหน้าแรก',
  'sys.backToGallery': 'กลับไปแกลเลอรี',
  'sys.tryAgain': 'ลองอีกครั้ง',

  'sys.403.meta': '403 ไม่มีสิทธิ์เข้าถึง — Lixyte',
  'sys.403.label': '[ 403 · ไม่มีสิทธิ์เข้าถึง ]',
  'sys.403.title': 'ไม่ได้รับอนุญาต',
  'sys.403.body': 'คุณไม่มีสิทธิ์เข้าถึงหน้านี้หรือทรัพยากรนี้ กรุณาล็อกอินด้วยบัญชีที่ได้รับอนุญาต หรือกลับไปที่แกลเลอรี',
  'sys.403.signIn': 'ล็อกอิน',

  'sys.404.meta': '404 ไม่พบหน้า — Lixyte',
  'sys.404.label': '[ 404 · ไม่พบหน้า ]',
  'sys.404.title': 'ไม่พบหน้านี้',
  'sys.404.body': 'ไม่พบหน้าหรือโมเดล 3D ที่คุณต้องการ อาจไม่มีอยู่จริง ถูกลบไปแล้ว หรือย้ายไปที่อยู่อื่น',
  'sys.404.explore': 'ดูแกลเลอรี',

  'sys.500.label': '[ 500 · ระบบขัดข้อง ]',
  'sys.500.title': 'เกิดข้อผิดพลาดบางอย่าง',
  'sys.500.body': 'เกิดข้อผิดพลาดที่ไม่คาดคิดขณะโหลดหน้านี้ กรุณาลองอีกครั้งหรือกลับไปหน้าแรก',
  'sys.500.errorId': 'รหัสข้อผิดพลาด: {id}',

  'sys.galleryError': 'โหลดโมเดลไม่สำเร็จ กรุณาลองอีกครั้ง',
  'sys.modelNotFound': 'ไม่พบโมเดลนี้ หรือโมเดลถูกลบไปแล้ว',
  'sys.creatorNotFound': 'ไม่พบครีเอเตอร์คนนี้',

  'loader.label': '[ กำลังโหลด · Lixyte ]',
  'loader.message': 'กำลังซิงก์สตรีมโมเดล 3D…',
  'loader.gallery': 'กำลังโหลดแกลเลอรี',
  'loader.gallerySync': '[ กำลังซิงก์คลังโมเดล 3D… ]',
  'loader.model': 'กำลังโหลดรายละเอียดโมเดล',
  'loader.modelSync': '[ กำลังเชื่อมต่อสตรีม 3D… ]',
  'loader.description': '[ รายละเอียด ]',
  'loader.howToUse': '[ วิธีใช้งาน ]',
  'loader.page': 'กำลังโหลดหน้า',
  'loader.navigating': '[ กำลังไปยังหน้า · Lixyte ]',
  'loader.view': 'กำลังโหลดหน้า…',

  'embed.loading': 'กำลังโหลดตัวแสดงโมเดล 3D…',
  'embed.unavailable': 'ไม่พบโมเดล 3D บน CDN',
  'embed.previewOnly': 'ต้องซื้อเพื่อใช้งาน · แสดงไฟล์ตัวอย่าง (Preview)',
};
