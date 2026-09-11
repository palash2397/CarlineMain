import { diskStorage } from 'multer';
import { extname } from 'path';
import * as fs from 'fs';

export const multerConfig = (folderName: string, allowedExts?: string[]) => ({
  storage: diskStorage({
    destination: (req: any, file: any, callback: any) => {
      const uploadPath = `./uploads/${folderName}`;

      fs.mkdirSync(uploadPath, { recursive: true });
      callback(null, uploadPath);
    },
    filename: (req: any, file: any, callback: any) => {
      const fileExtName = extname(file.originalname).toLowerCase();
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      callback(null, `${uniqueSuffix}${fileExtName}`);
    },
  }),
  fileFilter: (req: any, file: any, callback: any) => {
    if (!allowedExts || allowedExts.length === 0) {
      return callback(null, true);
    }
    const fileExt = extname(file.originalname).toLowerCase().replace('.', '');
    if (allowedExts.includes(fileExt)) {
      callback(null, true);
    } else {
      callback(new Error(`File type .${fileExt} is not allowed. Supported: ${allowedExts.join(', ')}`), false);
    }
  },
});
