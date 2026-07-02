import { CustomButton } from "@/components/global/FormElements";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import useCustomToast from "@/hooks/useCustomToast";
import { useAppDispatch } from "@/store/hooks";
import { removeImage, updateImage, User } from "@/store/user/userSlice";
import React, { useRef, useState } from "react";

interface ChangeProfilePictureProps {
    user: User | null;
}

export default function ChangeProfilePicture({ user }: ChangeProfilePictureProps) {
    // profile image
    const [profileImage, setProfileImage] = useState<File | null>(null);
    const [previewImage, setPreviewImage] = useState<string | null>(null);

    // redux 
    const dispatch = useAppDispatch();

    // ref
    const fileRef = useRef<null | HTMLInputElement>(null);

    // button loading
    const [uploadBtnLoading, setUploadBtnLoading] = useState(false);
    const [removeBtnLoading, setRemoveBtnLoading] = useState(false);

    // toast
    const showToast = useCustomToast();

    // handle file input change
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.preventDefault();
        
        const target = e.target as HTMLInputElement;
        const image: File = (target.files as FileList)[0];
        setProfileImage(image);

        const preview = URL.createObjectURL(image);        
        setPreviewImage(preview);        
    };

    // handle profile image upload
    const handleUpload = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        setUploadBtnLoading(true);

        const image = profileImage as File;
        const formData = new FormData();
        formData.append("profileImage", image);

        dispatch(updateImage(formData)).unwrap().then((res) => {    
            showToast(res.message);
            setProfileImage(null);
            setPreviewImage(null); 
        }).catch((err) => {
            showToast(err, false);
        }).finally(() => setUploadBtnLoading(false));
    };

    // handle remove image 
    const handleRemove = () => {
        setRemoveBtnLoading(true);
        dispatch(removeImage()).unwrap().then((res) => {
            showToast(res.message);
            setProfileImage(null);
            setPreviewImage(null); 
        }).catch((err) => {
            showToast(err, false);
        }).finally(() => setRemoveBtnLoading(false));
    };

    return (
        <>
            <Avatar
                className="rounded-md w-24 h-24 cursor-pointer select-none"
                onClick={() => {
                    if (fileRef.current) {
                        fileRef.current.click()
                        fileRef.current.value = "";
                    }
                }}
            >
                <AvatarImage
                    src={previewImage ? previewImage : user?.profileImage}
                    alt={user?.firstName}
                />
                <AvatarFallback className="rounded-md">
                    {`${user?.firstName}`.slice(0, 1)}
                </AvatarFallback>
            </Avatar>
            <form className="w-64 flex flex-col gap-4" onSubmit={handleUpload}>
                <input
                    type="file"
                    name="profileImage"
                    id="profileImage"
                    accept="image/*"
                    hidden
                    ref={fileRef}
                    onChange={handleChange}
                />

                {/* upload image button */}
                <CustomButton 
                    disabled={uploadBtnLoading ? true : profileImage ? false : true}
                    loading={uploadBtnLoading}
                >
                    Change
                </CustomButton>

                {/* remove image button */}
                <CustomButton 
                    onClick={handleRemove} 
                    type="button" 
                    disabled={!user?.profileImage ? true : removeBtnLoading ? true : false}
                    loading={removeBtnLoading}
                    variant="secondary" 
                >
                    Remove
                </CustomButton>
            </form>
        </>
    );
}
