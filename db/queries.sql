-- 每天各类事件的去重 IP 数
SELECT day, event, COUNT(*) AS unique_ips
FROM analytics_events
WHERE path NOT LIKE '/__analytics_%'
GROUP BY day, event
ORDER BY day DESC, event;

-- 各页面每天的去重浏览与阅读完成数
SELECT day, path, event, COUNT(*) AS unique_ips
FROM analytics_events
WHERE event IN ('page_view', 'read_50', 'read_complete')
  AND path NOT LIKE '/__analytics_%'
GROUP BY day, path, event
ORDER BY day DESC, path, event;

-- 从站内入口点击各文章的去重 IP 数
SELECT day, target, COUNT(*) AS unique_clicks
FROM analytics_events
WHERE event = 'article_click'
GROUP BY day, target
ORDER BY day DESC, unique_clicks DESC;
