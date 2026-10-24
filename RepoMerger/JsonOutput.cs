using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Nodes;
namespace RepoMerger;
internal static class JsonOutput
{
    private static readonly JsonSerializerOptions Options = new() { WriteIndented = true, Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping };
    public static string Serialize(JsonNode Node) => Node.ToJsonString(Options);
}
