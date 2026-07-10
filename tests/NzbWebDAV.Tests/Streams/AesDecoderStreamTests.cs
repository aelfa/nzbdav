using System.Security.Cryptography;
using NzbWebDAV.Models;
using NzbWebDAV.Streams;

namespace NzbWebDAV.Tests.Streams;

public class AesDecoderStreamTests
{
    [Fact]
    public async Task ReadAsync_DecryptsAndHonorsDecodedLength()
    {
        var plaintext = Enumerable.Range(0, 37).Select(index => (byte)index).ToArray();
        var (ciphertext, parameters) = Encrypt(plaintext);
        await using var stream = new AesDecoderStream(
            new MemoryStream(ciphertext), parameters);

        using var destination = new MemoryStream();
        await stream.CopyToAsync(destination);

        Assert.Equal(plaintext, destination.ToArray());
        Assert.Equal(plaintext.Length, stream.Position);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(1)]
    [InlineData(15)]
    [InlineData(16)]
    [InlineData(17)]
    [InlineData(48)]
    public async Task Seek_DecryptsFromArbitraryByteOffset(int offset)
    {
        var plaintext = Enumerable.Range(0, 64).Select(index => (byte)index).ToArray();
        var (ciphertext, parameters) = Encrypt(plaintext);
        await using var stream = new AesDecoderStream(
            new MemoryStream(ciphertext), parameters);
        stream.Seek(offset, SeekOrigin.Begin);
        var buffer = new byte[Math.Min(9, plaintext.Length - offset)];

        var read = await stream.ReadAsync(buffer);

        Assert.Equal(plaintext.AsSpan(offset, read).ToArray(), buffer[..read]);
    }

    [Fact]
    public void Constructor_RejectsUnalignedCiphertext()
    {
        var parameters = new AesParams
        {
            Key = new byte[32],
            Iv = new byte[16],
            DecodedSize = 1
        };

        Assert.Throws<NotSupportedException>(
            () => new AesDecoderStream(new MemoryStream(new byte[15]), parameters));
    }

    private static (byte[] Ciphertext, AesParams Parameters) Encrypt(byte[] plaintext)
    {
        var key = Enumerable.Range(0, 32).Select(index => (byte)index).ToArray();
        var iv = Enumerable.Range(32, 16).Select(index => (byte)index).ToArray();
        var paddedLength = (plaintext.Length + 15) / 16 * 16;
        var padded = new byte[paddedLength];
        plaintext.CopyTo(padded, 0);

        using var aes = Aes.Create();
        aes.Mode = CipherMode.CBC;
        aes.Padding = PaddingMode.None;
        using var encryptor = aes.CreateEncryptor(key, iv);
        var ciphertext = encryptor.TransformFinalBlock(padded, 0, padded.Length);
        return (ciphertext, new AesParams
        {
            Key = key,
            Iv = iv,
            DecodedSize = plaintext.Length
        });
    }
}
