import { ContentReportForm } from "@/components/blocks/content-report";

export function ArticleReportForm({
  articleId,
  online,
}: {
  articleId: string;
  online: boolean;
}) {
  return (
    <div className="mt-3">
      <ContentReportForm
        targetType="article"
        targetId={articleId}
        online={online}
        label="Report article"
      />
    </div>
  );
}
