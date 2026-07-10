using System.Text;
using NzbWebDAV.Par2Recovery;

namespace NzbWebDAV.Tests.Par2Recovery;

public class Par2Tests
{
    [Fact]
    public void HasPar2MagicBytes_RecognizesPacketHeader()
    {
        var bytes = new byte[128];
        Encoding.ASCII.GetBytes("PAR2\0PKT").CopyTo(bytes, 0);

        Assert.True(Par2.HasPar2MagicBytes(bytes));
    }

    [Theory]
    [InlineData("")]
    [InlineData("not par2")]
    public void HasPar2MagicBytes_RejectsInvalidInput(string content)
    {
        Assert.False(Par2.HasPar2MagicBytes(Encoding.ASCII.GetBytes(content)));
    }

    [Fact]
    public async Task ReadFileDescriptions_StopsAtInvalidPacket()
    {
        await using var stream = new MemoryStream(Encoding.ASCII.GetBytes("not a packet"));

        var descriptions = new List<object>();
        await foreach (var description in Par2.ReadFileDescriptions(stream))
            descriptions.Add(description);

        Assert.Empty(descriptions);
    }
}
