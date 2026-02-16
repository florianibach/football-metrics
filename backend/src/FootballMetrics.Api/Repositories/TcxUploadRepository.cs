using FootballMetrics.Api.Data;
using FootballMetrics.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace FootballMetrics.Api.Repositories;

public class TcxUploadRepository : ITcxUploadRepository
{
    private readonly FootballMetricsDbContext _dbContext;

    public TcxUploadRepository(FootballMetricsDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<TcxUpload> AddAsync(TcxUpload upload, CancellationToken cancellationToken = default)
    {
        _dbContext.TcxUploads.Add(upload);
        await _dbContext.SaveChangesAsync(cancellationToken);
        return upload;
    }

    public async Task<IReadOnlyList<TcxUpload>> ListAsync(CancellationToken cancellationToken = default)
    {
        return await _dbContext.TcxUploads
            .OrderByDescending(item => item.UploadedAtUtc)
            .ToListAsync(cancellationToken);
    }
}
