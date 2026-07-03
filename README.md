# Cloudfly
[![React](https://img.shields.io/badge/React-%2320232a.svg?logo=react&logoColor=%2361DAFB)](#)
[![Node.js](https://img.shields.io/badge/Node.js-6DA55F?logo=node.js&logoColor=white)](#)
[![Express.js](https://img.shields.io/badge/Express.js-%23404d59.svg?logo=express&logoColor=%2361DAFB)](#)
[![MySQL](https://img.shields.io/badge/MySQL-4479A1?logo=mysql&logoColor=fff)](#)
[![MinIO](https://img.shields.io/badge/MinIO-C72E49?logo=minio&logoColor=fff)](#)

This project is a file storage and sharing web application built with React, Node.js, Express.js, and MySQL.

<p align="center">
    <img src="./images/drive_view.jpg" width="600" alt="Cloudfly Drive Page"/>
</p>

## Features

- **Authentication & User Management**
  - Email/Password login and registration
  - Google OAuth ([Passport.js](https://www.passportjs.org/))
  - Cookie-based JWT
  - Forgot/Reset password ([Nodemailer](https://nodemailer.com/))
  - Profile editing
  - Account deletion

- **File & Folder Management**
  - File uploads via presigned URLs
  - File versioning
  - Create folders and subfolders
  - Rename, move, star/unstar files and folders
  - File and folder search
  - Set files as public/private
  - Public shareable links for files
  - File preview
  - Trash bin

- **UI/UX**
  - Modern user interface ([Shadcn UI](https://ui.shadcn.com/))
  - Responsive design
  - Dark/light theme
  - Page transition effect ([Framer Motion](https://motion.dev/))
  - Loading states
  - Upload status display
  - Multi select + Selection rectangle
  - Drag and drop

## Installation

1. **Clone the repository**
```bash
git clone https://github.com/7ched7/cloudfly.git
cd cloudfly
```

2. **Create environment variables**
- Create `.env.local` file in the `frontend` directory
```ini
VITE_BASE_URL=http://localhost:5173
VITE_BACKEND_URL=http://localhost:5000
```

- Create `.env` file in the `backend` directory
```ini
NODE_ENV=development
PORT=5000  

BASE_URL=http://localhost:5000
FRONTEND_URL=http://localhost:5173

# mysql configuration
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=cloudfly_db

# minio configuration
MINIO_INTERNAL_ENDPOINT=http://localhost:9000
MINIO_PUBLIC_ENDPOINT=http://localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_FILES_BUCKET=files
MINIO_IMAGES_BUCKET=images

# google oauth configuration
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback

# jwt configuration
JWT_SECRET=secret
JWT_LIFETIME=1h

# nodemailer (Email service provider is Gmail)
EMAIL_SERVICE_EMAIL=your_google_email_address
EMAIL_SERVICE_PASSWORD=your_app_password
```

3. **Start the application**
```bash
docker-compose up
```

## API Endpoints

<details>
  <summary>Auth Routes</summary>

  Endpoint|Method|Description
  -|-|-
  /api/auth/login|POST|Logs in a user
  /api/auth/register|POST|Creates a new account
  /api/auth/logout|POST|Logs out of the account
  /api/auth/forgot-password|POST|Sends a password reset link
  /api/auth/reset-password|POST|Sets a new password
  /api/auth/verify-token|POST|Verifies JWT token

  * Example Request
  ```json
  POST /api/auth/login
  {
    "email": "johndoe@mail.com",
    "password": "123456"
  }
  ```

  * Example Response
  ```json
  {
    "firstName": "john",
    "lastName": "doe",
    "email": "johndoe@mail.com",
    "profileImage": "http://localhost:9000/images/avatars/1",
    "currentStorage": 0,
    "maxStorage": 10737418240
  }
  ```
</details>

<details>
  <summary>User Routes</summary>

  Endpoint|Method|Description
  -|-|-
  /api/user/update-image|PUT|Updates the profile image
  /api/user/remove-image|DELETE|Removes the profile image
  /api/user/update-name|PUT|Updates the user's name
  /api/user/change-password|PUT|Changes the current password
  /api/user/delete|DELETE|Permanently deletes the account

  * Example Request
  ```json
  PUT /api/user/update-name
  { 
    "firstName": "jane", 
    "lastName": "doe" 
  }
  ```

  * Example Response
  ```json
  {
    "firstName": "jane",
    "lastName": "doe",
    "message": "Your name has been successfully updated"
  }
  ```
</details>

<details>
  <summary>Drive Routes</summary>

  Endpoint|Method|Description
  -|-|-
  /api/drive/presigned-urls|POST|Creates presigned URLs
  /api/drive/complete-upload|PUT|Finalizes upload process
  /api/drive/get/:id|GET|Retrieves files and folders
  /api/drive/search|GET|Searches files and folders
  /api/drive/get-starred|GET|Retrieves starred items
  /api/drive/get-trashed|GET|Retrieves items in the trash
  /api/drive/get-file/:id|GET|Retrieves file details
  /api/drive/download/:id|GET|Downloads the file
  /api/drive/create-folder|POST|Creates a new folder
  /api/drive/rename|PUT|Renames a file or folder
  /api/drive/star|PUT|Stars items
  /api/drive/unstar|PUT|Removes star from the items
  /api/drive/get-folders/:id|GET|Retrieves subfolders of a specific folder
  /api/drive/move|PUT|Moves items to another folder
  /api/drive/share-file/:id|PUT|Makes a file public and generates a shareable link
  /api/drive/make-file-private/:id|PUT|Makes a file private
  /api/drive/move-to-trash|PUT|Moves items to trash
  /api/drive/restore|PUT|Restores items from the trash
  /api/drive/delete|DELETE|Permanently deletes items
  /api/drive/file-preview-public/:key|GET|Public file preview
  /api/drive/get-file-public/:key|GET|Retrieves public file details
  /api/drive/download-public/:key|GET|Downloads a public file

  * Example Request
  ```json
  POST /api/drive/create-folder
  { 
    "name": "images", 
    "parent": "root" 
  }
  ```

  * Example Response
  ```json
  {
    "folder": {
      "id": "1",
      "parent": null,
      "name": "images",
      "isStarred": false
    },
    "message": "Folder created successfully"
  }
  ```
</details>

---

This project is licensed under the [MIT License](LICENSE).
