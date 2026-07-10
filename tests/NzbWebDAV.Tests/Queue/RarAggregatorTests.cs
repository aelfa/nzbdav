using NzbWebDAV.Models;
using NzbWebDAV.Models.Nzb;
using NzbWebDAV.Queue.FileAggregators;
using NzbWebDAV.Queue.FileProcessors;

namespace NzbWebDAV.Tests.Queue;

public class RarAggregatorTests
{
    [Fact]
    public void SortByPartNumber_NormalizesFilenameNumbersAgainstHeaders()
    {
        var second = Segment(headerPart: 1, filenamePart: 2, start: 5, length: 5);
        var first = Segment(headerPart: 0, filenamePart: 1, start: 0, length: 5);

        var sorted = RarAggregator.SortByPartNumber([second, first]);

        Assert.Equal(new[] { first, second }, sorted);
    }

    [Fact]
    public void SortByPartNumber_RejectsDuplicateNormalizedParts()
    {
        var first = Segment(headerPart: 0, filenamePart: 1, start: 0, length: 5);
        var duplicate = Segment(headerPart: 0, filenamePart: 1, start: 5, length: 5);

        Assert.Throws<InvalidDataException>(
            () => RarAggregator.SortByPartNumber([first, duplicate]));
    }

    [Fact]
    public void ValidateVolumes_RejectsMissingData()
    {
        var segment = Segment(headerPart: 0, filenamePart: 1, start: 0, length: 10);
        segment = new RarProcessor.StoredFileSegment
        {
            NzbFile = segment.NzbFile,
            PartSize = segment.PartSize,
            ArchiveName = segment.ArchiveName,
            PartNumber = segment.PartNumber,
            ReleaseDate = segment.ReleaseDate,
            PathWithinArchive = segment.PathWithinArchive,
            ByteRangeWithinPart = segment.ByteRangeWithinPart,
            AesParams = null,
            FileUncompressedSize = 100
        };

        Assert.Throws<InvalidDataException>(
            () => RarAggregator.ValidateVolumes([segment]));
    }

    private static RarProcessor.StoredFileSegment Segment(
        int headerPart, int filenamePart, long start, long length)
    {
        return new RarProcessor.StoredFileSegment
        {
            NzbFile = new NzbFile { Subject = "archive" },
            PartSize = length,
            ArchiveName = "archive",
            PartNumber = new RarProcessor.PartNumber
            {
                PartNumberFromHeader = headerPart,
                PartNumberFromFilename = filenamePart
            },
            ReleaseDate = DateTimeOffset.UnixEpoch,
            PathWithinArchive = "movie.mkv",
            ByteRangeWithinPart = LongRange.FromStartAndSize(start, length),
            AesParams = null,
            FileUncompressedSize = 10
        };
    }
}
