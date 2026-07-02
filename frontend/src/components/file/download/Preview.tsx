import { previewFile } from "@/utils/preview"
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

export default function Preview({ data, isLoading, error }: { data: { mimeType: string, url: string }, isLoading: boolean, error: string }) {    
    const [preview, setPreview] = useState<{ url: string | undefined, mimeType: string | null }>({
        url: undefined,
        mimeType: null,
    });

    useEffect(() => {
        if (data && data.mimeType && data.url) {
            setPreview({ url: data.url, mimeType: data.mimeType})
        }
    }, [data]);

    return isLoading ? <Loader2 className="animate-spin" />
            :
            error ? <p className="text-xs text-zinc-500 select-none">{error}</p>
            :
            preview.mimeType?.startsWith("image/") && preview?.url ?
            <img src={preview.url} className="h-full object-cover rounded-md select-none pointer-events-none" />
            :
            preview.mimeType?.startsWith("video/") && preview?.url ?
            <video src={preview.url} controls className="w-full h-full object-cover rounded-md" />
            :
            preview.mimeType?.startsWith("audio/") && preview?.url ?
            <audio src={preview.url} controls />
            :
            preview.mimeType == "application/pdf" && preview?.url ?
            <iframe src={preview.url} className="w-full h-full"/>
            :
            preview.mimeType?.startsWith("text/plain") && preview?.url ?
            <TextPreview url={preview.url} />
            :
            <p className="text-xs text-zinc-500 select-none">This file cannot be previewed</p>       
}

function TextPreview({ url }: { url: string}) {
    const [content, setContent] = useState('');

    useEffect(() => {
        fetch(url)
        .then(res => res.text())
        .then(text => {
            setContent(text);
        })
    }, [url]);

    return (
        <pre>{content}</pre>
    );
}
