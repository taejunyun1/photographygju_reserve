<?php
declare(strict_types=1);

$workerBase = 'https://photographygju-reserve.taejunyun.workers.dev';
$requestUri = $_SERVER['REQUEST_URI'] ?? '/api/';
$path = parse_url($requestUri, PHP_URL_PATH) ?: '/api/';
$query = parse_url($requestUri, PHP_URL_QUERY);
$target = $workerBase . $path . ($query ? '?' . $query : '');
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$body = file_get_contents('php://input') ?: '';

function gju_header_value(string $name): string
{
    $serverKey = 'HTTP_' . strtoupper(str_replace('-', '_', $name));
    if (isset($_SERVER[$serverKey])) {
        return (string) $_SERVER[$serverKey];
    }
    if (strtolower($name) === 'content-type' && isset($_SERVER['CONTENT_TYPE'])) {
        return (string) $_SERVER['CONTENT_TYPE'];
    }
    if (strtolower($name) === 'authorization' && isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
        return (string) $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
    }
    return '';
}

function gju_safe_header_value(string $value, int $maxLength = 500): string
{
    return substr(str_replace(["\r", "\n"], ' ', trim($value)), 0, $maxLength);
}

if (!function_exists('curl_init')) {
    http_response_code(502);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    echo json_encode([
        'ok' => false,
        'error' => 'Dothome PHP cURL extension is required for API proxying.'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$forwardHeaders = ['Accept: application/json'];
$contentType = gju_safe_header_value(gju_header_value('content-type'), 200);
$authorization = gju_safe_header_value(gju_header_value('authorization'), 2000);
$clientIp = gju_safe_header_value((string) ($_SERVER['REMOTE_ADDR'] ?? ''), 80);
$userAgent = gju_safe_header_value(gju_header_value('user-agent'), 500);
if ($contentType !== '') {
    $forwardHeaders[] = 'Content-Type: ' . $contentType;
}
if ($authorization !== '') {
    $forwardHeaders[] = 'Authorization: ' . $authorization;
}
if ($clientIp !== '') {
    $forwardHeaders[] = 'X-Forwarded-For: ' . $clientIp;
}
if ($userAgent !== '') {
    $forwardHeaders[] = 'User-Agent: ' . $userAgent;
}
$forwardedProto = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
$forwardHeaders[] = 'X-Forwarded-Proto: ' . $forwardedProto;

$ch = curl_init($target);
curl_setopt_array($ch, [
    CURLOPT_CUSTOMREQUEST => $method,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HEADER => true,
    CURLOPT_FOLLOWLOCATION => false,
    CURLOPT_CONNECTTIMEOUT => 10,
    CURLOPT_TIMEOUT => 35,
    CURLOPT_HTTPHEADER => $forwardHeaders
]);

if (!in_array($method, ['GET', 'HEAD'], true)) {
    curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
}

$response = curl_exec($ch);
if ($response === false) {
    $error = curl_error($ch);
    curl_close($ch);
    http_response_code(502);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    echo json_encode([
        'ok' => false,
        'error' => 'Cloudflare Worker API proxy failed: ' . $error
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$status = curl_getinfo($ch, CURLINFO_RESPONSE_CODE) ?: 502;
$headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
$rawHeaders = substr($response, 0, $headerSize);
$responseBody = substr($response, $headerSize);
curl_close($ch);

http_response_code((int) $status);
foreach (explode("\r\n", $rawHeaders) as $line) {
    if (stripos($line, 'content-type:') === 0 ||
        stripos($line, 'cache-control:') === 0 ||
        stripos($line, 'x-content-type-options:') === 0 ||
        stripos($line, 'referrer-policy:') === 0) {
        header($line);
    }
}

echo $responseBody;
