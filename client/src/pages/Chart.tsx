import React, { useEffect, useRef, useState } from "react";
import { Box, Divider, Typography, CircularProgress } from "@mui/material";
import { styled } from "@mui/material/styles";
import apiFetch from "@/services/axios/handler";
import { IMBRACE_ORG_ID } from "@/constants/app";
import * as echarts from "echarts";
import { AppGatewayClient } from "@/services/axios";

// Styled components using MUI's styled API
const PageContainer = styled(Box)(({ theme }) => ({
  height: "100vh",
  display: "flex",
  flexDirection: "column",
  overflow: "auto",
  padding: 9,
}));

type ChartItem = { id: string; option: any };
type ChartError = { id: string; message: string; config: any };

const Chart: React.FC = () => {
  const [chatId, setChatId] = useState<string>("");
  const [chartId, setChartId] = useState<string>("");
  const [chartItems, setChartItems] = useState<ChartItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chartErrors, setChartErrors] = useState<Record<string, ChartError>>(
    {}
  );
  const containerRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const instancesRef = useRef<Map<string, echarts.ECharts>>(new Map());
  const chartItemsRef = useRef<ChartItem[]>([]);
  const listContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    chartItemsRef.current = chartItems;
  }, [chartItems]);

  const scrollToBottom = () => {
    const el = listContainerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  };


  const refreshAndAppend = async (chatIdValue: string, incomingData: any) => {
    try {
      const orgId = window.localStorage.getItem(IMBRACE_ORG_ID);
      const url = `/chat/ai/api/v1/rag/echarts/${chatIdValue}`;
      const response = await apiFetch<any>(url, "GET", {}, AppGatewayClient, {
        headers: { "x-organization-id": orgId || "" },
      });

      const fetchedItems: ChartItem[] = normalizeToChartItems(response.data) || [];

      const existingIds = new Set(chartItemsRef.current.map((i) => i.id));
      const newItems = fetchedItems.filter((item) => !existingIds.has(item.id));

      if (newItems.length === 0) return;

      setChartItems((prev) => [...prev, ...newItems]);

      // Scroll to bottom after the new items are rendered
      setTimeout(() => {
        scrollToBottom();
      }, 0);
    } catch (err) {
      console.error("refreshAndAppend error", err);
    }
  };

  const normalizeToChartItems = (data: any): any => {
    if (!data) return [];

    // Support format: { echarts: [{ id, echart_data }] }
    const list = data?.echarts;
    if (Array.isArray(list)) {
      return list.map((item: any) => {
        const id = item.id ?? item._id;
        const option = item.echart_data;
        return { id, option };
      });
    }
  };

  const fetchChartData = async (chatId: string) => {
    try {
      setIsLoading(true);
      // Reset list and errors while loading
      setChartItems([]);
      setChartErrors({});
      const orgId = window.localStorage.getItem(IMBRACE_ORG_ID);
      const url = `/chat/ai/api/v1/rag/echarts/${chatId}`;
      const response = await apiFetch<any>(url, "GET", {}, AppGatewayClient, {
        headers: {
          "x-organization-id": orgId || "",
        },
      });
      setChartItems(normalizeToChartItems(response.data));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const scrollToChartItem = (chartId: string) => {
    const container = listContainerRef.current;
    if (!container) return;
    const chartItem = document.getElementById(chartId);
    if (!chartItem) return;

    const itemRect = chartItem.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const targetTop = itemRect.top - containerRect.top + container.scrollTop;
    container.scrollTo({ top: targetTop, behavior: "smooth" });
  };

  useEffect(() => {
    // Handle message from parent
    const onMessage = (event: MessageEvent) => {
      console.log("event in messageSuggestion", event);
      if (event.data.type !== "CHART") return;

      if (event.data.event === "SEND_CHART_CONTEXT_TO_NEXT_BEST_ACTION") {
        const { chatId: chatIdFromEvent, chartId, chartData } = event.data.data;
        console.log("chatId", chatIdFromEvent, "chartId", chartId);
        setChatId(chatIdFromEvent);
        setChartId(chartId);

        if (chartData && chatIdFromEvent) {
          refreshAndAppend(chatIdFromEvent, chartData);
        }
        if(chartId) {
          scrollToChartItem(chartId);
        }
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [chatId]);

  // Fetch when chatId or chartId changes
  // Reason: When user clicks "See Chart" on different messages within the same chat,
  // chatId stays the same but chartId changes — we need to re-fetch and scroll.
  useEffect(() => {
    if (!chatId) {
      setChartItems([]);
      setChartErrors({});
      return;
    }
    fetchChartData(chatId);
  }, [chatId, chartId]);

  // Scroll when either target id or chart list changes
  useEffect(() => {
    if (chartId && chartItems.length) {
      scrollToChartItem(chartId);
    }
  }, [chartId, chartItems.length]);

  // Initialize/update all chart instances when chartItems change
  useEffect(() => {
    // Create or update instances
    chartItems.forEach((item) => {
      const container = containerRefs.current[item.id];
      if (!container) return;

      // If this chart was marked as errored, skip re-rendering
      if (chartErrors[item.id]) {
        return;
      }

      let instance = instancesRef.current.get(item.id);
      if (!instance) {
        instance = echarts.init(container, undefined, { renderer: "canvas" });
        instancesRef.current.set(item.id, instance);
      }

      const option = item.option ?? {
        title: { text: "No data", left: "center" },
        xAxis: { type: "category", data: [] },
        yAxis: { type: "value" },
        series: [],
      };

      // Position legend at bottom, horizontal with auto wrap
      if (option.legend) {
        const { top, orient, type, left, right, ...legendRest } = option.legend;
        option.legend = {
          ...legendRest,
          type: "plain",
          orient: "horizontal",
          bottom: 0,
          left: "center",
          width: "90%",
        };
      }

      // Adjust grid/series to leave room for legend at bottom
      if (option.series) {
        const hasPie = option.series.some(
          (s: any) => s.type === "pie"
        );
        if (hasPie) {
          option.series = option.series.map((s: any) =>
            s.type === "pie" ? { ...s, center: s.center || ["50%", "38%"], radius: s.radius || ["0%", "55%"] } : s
          );
        } else if (option.grid) {
          option.grid = { ...option.grid, bottom: 60 };
        } else {
          option.grid = { ...(option.grid || {}), bottom: 60 };
        }
      }

      try {
        instance.setOption(option, true);
        instance.resize();
      } catch (e) {
        console.error("Error rendering chart", item.id, e);

        const errorMessage = e instanceof Error ? e.message : String(e);

        // Mark this chart as having invalid configuration to show text instead of chart
        setChartErrors((prev) => ({
          ...prev,
          [item.id]: {
            id: item.id,
            message: errorMessage,
            config: option,
          },
        }));

        // Clean up the failed instance (if any)
        if (instance) {
          instance.dispose();
          instancesRef.current.delete(item.id);
        }
      }
    });

    // Dispose instances whose items were removed and clean up their errors
    const validIds = new Set(chartItems.map((i) => i.id));
    Array.from(instancesRef.current.keys()).forEach((id) => {
      if (!validIds.has(id)) {
        const instance = instancesRef.current.get(id);
        if (instance) {
          instance.dispose();
        }
        instancesRef.current.delete(id);
      }
    });
    
    // Clean up errors for removed charts
    setChartErrors((prev) => {
      const newErrors = { ...prev };
      let hasChanges = false;
      Object.keys(newErrors).forEach((id) => {
        if (!validIds.has(id)) {
          delete newErrors[id];
          hasChanges = true;
        }
      });
      return hasChanges ? newErrors : prev;
    });

    const handleResize = () => {
      instancesRef.current.forEach((instance) => instance.resize());
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [chartItems]);

  // Dispose chart instance on unmount
  useEffect(() => {
    return () => {
      instancesRef.current.forEach((instance) => instance.dispose());
      instancesRef.current.clear();
    };
  }, []);

  return (
    <PageContainer>
      <Box
        sx={{ borderRadius: "8px", overflow: "scroll" }}
        ref={listContainerRef}
      >
        {isLoading && (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: 360,
            }}
          >
            <CircularProgress />
          </Box>
        )}
        {error && <Box sx={{ p: 2, color: "error.main" }}>{error}</Box>}
        {!isLoading && !error && chartItems.length === 0 && (
          <Box sx={{ p: 3, textAlign: "center", color: "text.secondary" }}>
            <Typography variant="body1">
              No charts available. Please chat to generate chart data.
            </Typography>
          </Box>
        )}
        {chartItems.map((item, index) => (
          <React.Fragment key={item.id}>
            {chartErrors[item.id] ? (
              // Render error UI for this chart
              <Box
                id={item.id}
                sx={{
                  flexShrink: 0,
                  width: "100%",
                  minHeight: 420,
                  mb: 2,
                  p: 2,
                  backgroundColor: "rgba(211, 47, 47, 0.05)",
                  borderRadius: "8px",
                  border: "1px solid",
                  borderColor: "error.light",
                }}
              >
                <Typography
                  variant="subtitle1"
                  sx={{ color: "error.main", fontWeight: 600, mb: 1 }}
                >
                  ⚠️ Unable to render chart
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ color: "error.main", mb: 2 }}
                >
                  {chartErrors[item.id].message}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ color: "text.secondary", fontWeight: 600 }}
                >
                  Chart Config:
                </Typography>
                <Box
                  sx={{
                    mt: 1,
                    p: 1.5,
                    backgroundColor: "rgba(0, 0, 0, 0.04)",
                    borderRadius: "4px",
                    maxHeight: 300,
                    overflow: "auto",
                  }}
                >
                  <Typography
                    component="pre"
                    variant="body2"
                    sx={{
                      margin: 0,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      fontFamily: "monospace",
                      fontSize: "12px",
                    }}
                  >
                    {(() => {
                      try {
                        const raw = JSON.stringify(
                          chartErrors[item.id].config,
                          null,
                          2
                        );
                        return raw.length > 3000
                          ? `${raw.substring(0, 3000)}\n... (truncated)`
                          : raw;
                      } catch {
                        return "[Unable to stringify chart config]";
                      }
                    })()}
                  </Typography>
                </Box>
              </Box>
            ) : (
              // Render chart container
              <Box
                id={item.id}
                ref={(el: HTMLDivElement | null) => {
                  containerRefs.current[item.id] = el;
                }}
                sx={{ flexShrink: 0, width: "100%", minHeight: 500, mb: 2 }}
              />
            )}
            {index < chartItems.length - 1 && <Divider sx={{ my: 2 }} />}
          </React.Fragment>
        ))}
      </Box>
    </PageContainer>
  );
};

export default Chart;
