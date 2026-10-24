using System.Globalization;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Sockets;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
namespace RepoMerger;
internal readonly record struct Validator(string? ETag, string? LastModified)
{
    public bool HasValue => ETag is not null || LastModified is not null;
}
internal readonly record struct FetchResult(string? Body, string? Error, bool NotModified = false, Validator Validator = default);
internal readonly record struct JsonFetchResult(JsonNode? Node, string? Error, bool NotModified = false, Validator Validator = default);
internal static class WebFetch
{
    private static readonly HttpClient Client = CreateClient();

    private static HttpClient CreateClient()
    {
        SocketsHttpHandler handler = new() { UseProxy = false, AllowAutoRedirect = true, MaxAutomaticRedirections = 5, ConnectTimeout = TimeSpan.FromSeconds(10), ConnectCallback = ConnectAsync };
        HttpClient client = new(handler) { Timeout = Timeout.InfiniteTimeSpan };
        client.DefaultRequestHeaders.UserAgent.ParseAdd("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");
        client.DefaultRequestHeaders.CacheControl = new CacheControlHeaderValue { NoCache = true };
        client.DefaultRequestHeaders.Pragma.Add(new NameValueHeaderValue("no-cache"));
        return client;
    }

    public static bool IsPublicAddress(IPAddress Address)
    {
        IPAddress ip = Address.IsIPv4MappedToIPv6 ? Address.MapToIPv4() : Address;
        if (IPAddress.IsLoopback(ip) || ip.Equals(IPAddress.Any) || ip.Equals(IPAddress.IPv6Any) || ip.IsIPv6LinkLocal || ip.IsIPv6SiteLocal || ip.IsIPv6Multicast) return false;
        byte[] b = ip.GetAddressBytes();
        return ip.AddressFamily == AddressFamily.InterNetwork ? !(b[0] == 0 || b[0] == 10 || b[0] >= 224 || (b[0] == 100 && b[1] >= 64 && b[1] <= 127) || (b[0] == 169 && b[1] == 254) || (b[0] == 172 && b[1] >= 16 && b[1] <= 31) || (b[0] == 192 && b[1] == 168) || (b[0] == 192 && b[1] == 0 && b[2] == 0) || (b[0] == 198 && (b[1] == 18 || b[1] == 19))) : (b[0] & 0xFE) != 0xFC;
    }

    private static async ValueTask<Stream> ConnectAsync(SocketsHttpConnectionContext Context, CancellationToken Token)
    {
        string host = Context.DnsEndPoint.Host;
        IPAddress[] addresses = await Dns.GetHostAddressesAsync(host, Token);
        IPAddress[] safe = addresses.Where(IsPublicAddress).ToArray();
        if (safe.Length == 0) throw new HttpRequestException($"{host} does not resolve to a public address");
        Socket socket = new(SocketType.Stream, ProtocolType.Tcp) { NoDelay = true };
        try
        {
            await socket.ConnectAsync(safe, Context.DnsEndPoint.Port, Token);
            return new NetworkStream(socket, true);
        }
        catch
        {
            socket.Dispose();
            throw;
        }
    }

    private static string? CleanHeader(string? Value) => Value is not null && Value.Length is > 0 and <= 200 && Value.All(c => c is >= ' ' and <= '~') ? Value : null;
    private static Validator ReadValidator(HttpResponseMessage Response) => new(CleanHeader(Response.Headers.ETag?.ToString()), CleanHeader(Response.Content.Headers.LastModified?.UtcDateTime.ToString("R", CultureInfo.InvariantCulture)));

    private static HttpRequestMessage CreateRequest(string Url, Validator Known)
    {
        HttpRequestMessage request = new(HttpMethod.Get, Url);
        if (Known.ETag is not null) request.Headers.TryAddWithoutValidation("If-None-Match", Known.ETag);
        if (Known.LastModified is not null) request.Headers.TryAddWithoutValidation("If-Modified-Since", Known.LastModified);
        return request;
    }

    private static string Describe(Exception Ex) => Ex.InnerException is null ? Ex.Message : Describe(Ex.InnerException);

    private static async Task<string> ReadCappedAsync(HttpResponseMessage Response, CancellationToken Token)
    {
        long? length = Response.Content.Headers.ContentLength;
        if (length > Settings.MaxBodyBytes) throw new InvalidDataException($"response is larger than {Settings.MaxBodyBytes / 1024 / 1024} MB");
        await using Stream stream = await Response.Content.ReadAsStreamAsync(Token);
        using MemoryStream buffer = new();
        byte[] chunk = new byte[81920];
        int read;
        while ((read = await stream.ReadAsync(chunk, Token)) > 0)
        {
            if (buffer.Length + read > Settings.MaxBodyBytes) throw new InvalidDataException($"response is larger than {Settings.MaxBodyBytes / 1024 / 1024} MB");
            buffer.Write(chunk, 0, read);
        }
        return Encoding.UTF8.GetString(buffer.GetBuffer(), 0, (int)buffer.Length).TrimStart('\uFEFF');
    }

    public static async Task<FetchResult> FetchAsync(string Url, int Retries, Validator Known = default)
    {
        string error = "unknown error";
        for (int attempt = 1; attempt <= Retries; attempt++)
        {
            Log.Info($"Fetching {Url} (attempt {attempt}/{Retries})");
            using CancellationTokenSource timeout = new(Settings.RequestTimeout);
            try
            {
                using HttpRequestMessage request = CreateRequest(Url, Known);
                using HttpResponseMessage response = await Client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, timeout.Token);
                if (response.StatusCode == HttpStatusCode.NotModified && Known.HasValue) return new FetchResult(null, null, true, Known);
                if (response.IsSuccessStatusCode) return new FetchResult(await ReadCappedAsync(response, timeout.Token), null, false, ReadValidator(response));
                error = $"HTTP {(int)response.StatusCode} {response.ReasonPhrase}";
            }
            catch (Exception ex) when (ex is HttpRequestException or OperationCanceledException or InvalidDataException or IOException)
            {
                error = ex is OperationCanceledException ? $"request timed out after {Settings.RequestTimeout.TotalSeconds:0} seconds" : Describe(ex);
            }
            Log.Info($"Attempt {attempt}/{Retries} for {Url} failed: {error}");
            if (attempt < Retries) await Task.Delay(Settings.RetryDelay * attempt);
        }
        return new FetchResult(null, error);
    }

    private static JsonNode? FromElement(JsonElement Element)
    {
        if (Element.ValueKind == JsonValueKind.Object)
        {
            JsonObject result = new();
            foreach (JsonProperty property in Element.EnumerateObject()) result[property.Name] = FromElement(property.Value);
            return result;
        }
        if (Element.ValueKind == JsonValueKind.Array)
        {
            JsonArray array = new();
            foreach (JsonElement item in Element.EnumerateArray()) array.Add(FromElement(item));
            return array;
        }
        if (Element.ValueKind == JsonValueKind.String) return JsonValue.Create(Element.GetString());
        return Element.ValueKind == JsonValueKind.Null ? null : JsonValue.Create(Element.Clone());
    }

    public static async Task<JsonFetchResult> FetchJsonAsync(string Url, int Retries, Validator Known = default)
    {
        FetchResult fetched = await FetchAsync(Url, Retries, Known);
        if (fetched.NotModified) return new JsonFetchResult(null, null, true, fetched.Validator);
        if (fetched.Body is null) return new JsonFetchResult(null, fetched.Error ?? "no data returned");
        try
        {
            using JsonDocument document = JsonDocument.Parse(fetched.Body);
            JsonNode? node = FromElement(document.RootElement);
            return node is null ? new JsonFetchResult(null, "response was empty") : new JsonFetchResult(node, null, false, fetched.Validator);
        }
        catch (JsonException ex)
        {
            return new JsonFetchResult(null, $"invalid JSON: {ex.Message}");
        }
    }
}