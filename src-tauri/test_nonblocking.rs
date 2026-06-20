fn main() { let l: Option<interprocess::local_socket::Listener> = None; if let Some(listener) = l { let _ = listener.set_nonblocking(interprocess::local_socket::ListenerNonblockingMode::Accept); } }
