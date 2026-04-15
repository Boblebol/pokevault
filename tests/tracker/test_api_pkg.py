"""tracker.api — module package."""


def test_tracker_api_package_doc() -> None:
    import tracker.api as api

    assert api.__doc__ and "HTTP" in api.__doc__
