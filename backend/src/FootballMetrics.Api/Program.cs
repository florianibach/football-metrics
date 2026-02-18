using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using System.Threading.RateLimiting;
using FootballMetrics.Api.Services;
using FootballMetrics.Api.Data;
using FootballMetrics.Api.Repositories;
using FootballMetrics.Api.UseCases;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddProblemDetails();
builder.Services.AddHealthChecks();
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddFixedWindowLimiter("upload", limiterOptions =>
    {
        limiterOptions.PermitLimit = 10;
        limiterOptions.Window = TimeSpan.FromMinutes(1);
        limiterOptions.QueueLimit = 0;
    });
});
builder.Services.AddCors(options =>
{
    options.AddPolicy("FrontendOrigins", policy =>
    {
        var allowedOrigins = builder.Configuration
            .GetSection("Cors:AllowedOrigins")
            .Get<string[]>()
            ?? ["http://localhost:3000", "http://localhost:5173"];

        policy
            .WithOrigins(allowedOrigins)
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? "Data Source=data/footballmetrics.db";

builder.Services.AddSingleton<ISqliteConnectionFactory>(_ => new SqliteConnectionFactory(connectionString));
builder.Services.AddSingleton<IDatabaseInitializer, DatabaseInitializer>();
builder.Services.AddScoped<ITcxUploadRepository, TcxUploadRepository>();
builder.Services.AddScoped<IUserProfileRepository, UserProfileRepository>();
builder.Services.AddScoped<IMetricThresholdResolver, MetricThresholdResolver>();
builder.Services.AddSingleton<IUploadFormatAdapter, TcxUploadFormatAdapter>();
builder.Services.AddSingleton<IUploadFormatAdapterResolver, UploadFormatAdapterResolver>();
builder.Services.AddScoped<ITcxSessionUseCase, TcxSessionUseCase>();
builder.Services.AddScoped<IProfileUseCase, ProfileUseCase>();

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var initializer = scope.ServiceProvider.GetRequiredService<IDatabaseInitializer>();
    await initializer.InitializeAsync();
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseRateLimiter();

app.Use(async (context, next) =>
{
    const string correlationHeader = "X-Correlation-ID";
    var correlationId = context.Request.Headers[correlationHeader].FirstOrDefault();
    if (string.IsNullOrWhiteSpace(correlationId))
    {
        correlationId = context.TraceIdentifier;
    }

    context.Response.Headers[correlationHeader] = correlationId;

    using (app.Logger.BeginScope(new Dictionary<string, object?> { ["CorrelationId"] = correlationId }))
    {
        await next();
    }
});

app.UseCors("FrontendOrigins");
app.Use(async (context, next) =>
{
    context.Response.Headers.TryAdd("X-Content-Type-Options", "nosniff");
    context.Response.Headers.TryAdd("X-Frame-Options", "DENY");
    context.Response.Headers.TryAdd("Referrer-Policy", "no-referrer");
    context.Response.Headers.TryAdd("X-XSS-Protection", "0");
    context.Response.Headers.TryAdd("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none';");
    await next();
});
app.UseAuthorization();
app.MapHealthChecks("/health/live", new HealthCheckOptions { Predicate = _ => false });
app.MapHealthChecks("/health/ready", new HealthCheckOptions());
app.MapControllers();

app.Run();

public partial class Program;
