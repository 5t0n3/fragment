const std = @import("std");
const zap = @import("zap");

fn on_request(r: zap.Request) void {
    r.sendBody("henlo") catch return;
}

pub fn main() !void {
    var listener = zap.HttpListener.init(.{
        .port = 8080,
        .on_request = on_request,
        .log = true,
    });

    try listener.listen();

    std.debug.print("listening!\n", .{});

    zap.start(.{
        .threads = 2,
        .workers = 2,
    });
}
