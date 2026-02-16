using FootballMetrics.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace FootballMetrics.Api.Data;

public class FootballMetricsDbContext : DbContext
{
    public FootballMetricsDbContext(DbContextOptions<FootballMetricsDbContext> options)
        : base(options)
    {
    }

    public DbSet<TcxUpload> TcxUploads => Set<TcxUpload>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<TcxUpload>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.FileName).HasMaxLength(260).IsRequired();
            entity.Property(e => e.StoredFilePath).HasMaxLength(512).IsRequired();
            entity.Property(e => e.UploadedAtUtc).IsRequired();
        });
    }
}
