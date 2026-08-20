import { EllipsisText, Typography } from '@imbrace/ui';
import { Box, Card, CardMedia, Skeleton } from '@mui/material';
import { useQuery } from '@tanstack/react-query';

import { linkPreview } from '@/services/api/crm';
import apiFetch from '@/services/axios/handler';

interface Props {
    value: string | { hyperlink: string; text: string };
}

export interface LinkPreviewData {
    title: string;
    description: string;
    imageUrl: string;
    canonicalUrl: string;
}

const getMetaData = async ({ queryKey }: { queryKey: string[] }) => {
    const url = queryKey[1];
    if (!url) {
        throw new Error('No url');
    }
    const { data } = await apiFetch<{ data: LinkPreviewData }>(linkPreview.api, linkPreview.method, { url });

    if (!data.data) {
        throw new Error('No preview data');
    }
    return data.data;
};

const LinkPreviewField = ({ value }: Props) => {
    const previewQuery = useQuery({
        queryFn: getMetaData,
        queryKey: ['linkPreview', typeof value === 'string' ? value : value.hyperlink],
        staleTime: 1000 * 60 * 60,
    });

    const { data: previewData, isLoading } = previewQuery;

    if (isLoading) {
        return (
            <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', border: 'none' }}>
                <Skeleton variant="rectangular" width={'96px'} height={'16px'} sx={{ borderRadius: '30px' }} />
            </Box>
        );
    }

    if (!previewData || 'error' in previewData || !previewData?.title) {
        return (
            <Box sx={{ width: '100%', padding: '7px 12px 7px 8.5px', display: 'flex', alignItems: 'center' }}>
                <EllipsisText
                    text={typeof value === 'string' ? value : value.text}
                    element={
                        <Typography
                            style={{
                                color: 'inherit',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                wordBreak: 'break-word',
                            }}
                        />
                    }
                />
            </Box>
        );
    }

    return (
        <Card
            sx={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: previewData?.imageUrl ? 0 : '7px 12px 7px 8.5px',
                boxShadow: 'none',
            }}
        >
            {previewData?.imageUrl && (
                <div
                    style={{
                        width: '64px',
                        height: '38px',
                        aspectRatio: '32/19',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <CardMedia
                        component="img"
                        sx={{
                            display: 'block',
                            width: 'auto',
                            maxHeight: '100%',
                            maxWidth: '100%',
                        }}
                        image={previewData.imageUrl}
                        alt={previewData?.title}
                    />
                </div>
            )}

            <EllipsisText
                text={previewData?.title}
                element={
                    <Typography
                        variant="CaptionBold"
                        style={{
                            paddingRight: '8px',
                            color: 'var(--color-light-7)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            wordBreak: 'break-word',
                        }}
                    />
                }
            />
        </Card>
    );
};

export default LinkPreviewField;
