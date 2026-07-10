using NzbWebDAV.Models.Nzb;
using NzbWebDAV.Queue.DeobfuscationSteps._1.FetchFirstSegment;
using NzbWebDAV.Queue.DeobfuscationSteps._3.GetFileInfos;

namespace NzbWebDAV.Tests.Queue;

public class GetFileInfosStepTests
{
    [Fact]
    public void GetFileInfos_UsesSubjectNameAndDetectsRarMagic()
    {
        byte[] rarHeader = [0x52, 0x61, 0x72, 0x21, 0x1A, 0x07, 0x00, 0x00];
        var releaseDate = DateTimeOffset.UtcNow;
        var file = new NzbFile
        {
            Subject = "\"Movie.Release.2026.rar\" yEnc (1/1)"
        };
        var input = new FetchFirstSegmentsStep.NzbFileWithFirstSegment
        {
            NzbFile = file,
            Header = null,
            First16KB = rarHeader,
            MissingFirstSegment = false,
            ReleaseDate = releaseDate
        };

        var result = Assert.Single(GetFileInfosStep.GetFileInfos([input], []));

        Assert.Equal("Movie.Release.2026.rar", result.FileName);
        Assert.Equal(releaseDate, result.ReleaseDate);
        Assert.True(result.IsRar);
        Assert.Null(result.FileSize);
    }

    [Fact]
    public void GetFileInfos_HandlesMissingFirstSegment()
    {
        var file = new NzbFile { Subject = "\"video.mkv\" yEnc" };
        var input = new FetchFirstSegmentsStep.NzbFileWithFirstSegment
        {
            NzbFile = file,
            Header = null,
            First16KB = null,
            MissingFirstSegment = true,
            ReleaseDate = DateTimeOffset.UtcNow
        };

        var result = Assert.Single(GetFileInfosStep.GetFileInfos([input], []));

        Assert.Equal("video.mkv", result.FileName);
        Assert.False(result.IsRar);
    }
}
